import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'node:http';
import type { Socket } from 'node:net';
import { Server as SocketIOServer } from 'socket.io';
import { authRouter } from './features/auth/auth.routes.js';
import { devRouter } from './features/auth/dev.routes.js';
import { campaignRouter } from './features/campaigns/campaigns.routes.js';
import { characterRouter } from './features/characters/characters.routes.js';
import { editorRouter, placementsRouter } from './features/editor/editor.routes.js';
import { fogRouter } from './features/play-area/fog.routes.js';
import { messagesRouter } from './features/play-area/messages.routes.js';
import { playAreaRouter } from './features/play-area/tokens.routes.js';
import { prisma } from './shared/db/prisma.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { sessionMiddleware } from './shared/middleware/session.js';
import { setupSocket } from './shared/socket/index.js';
import { setIo } from './shared/socket/io-instance.js';
import { env } from './shared/utils/env.js';

const app = express();
const httpServer = createServer(app);
const activeConnections = new Set<Socket>();

httpServer.on('connection', (socket) => {
  activeConnections.add(socket);
  socket.on('close', () => {
    activeConnections.delete(socket);
  });
});

const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Session middleware — must come after body parsing, before routes
app.use(sessionMiddleware);

// Static file serving for uploaded assets
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Feature routes registered here as phases are built
app.use('/api/auth', authRouter);
app.use('/api/campaigns', campaignRouter);
app.use('/api/campaigns', characterRouter);
app.use('/api/campaigns', playAreaRouter);
app.use('/api/campaigns', messagesRouter);
app.use('/api/campaigns', fogRouter);
app.use('/api/campaigns', editorRouter);
app.use('/api/campaigns', placementsRouter);

// Dev-only routes — never enable in production
if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
  app.use('/api/dev', devRouter);
}

// Error handling middleware — must be last
app.use(errorHandler);

// Socket.IO — session auth + feature handlers
setupSocket(io, sessionMiddleware);
setIo(io);

// Only auto-listen when NOT in test environment.
// Tests that need a live server (socket tests) call httpServer.listen() themselves.
if (env.NODE_ENV !== 'test') {
  httpServer
    .listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
    })
    .on('error', (err: NodeJS.ErrnoException) => {
      console.error('Failed to start server:', err.message);
      process.exit(1);
    });
}

// Graceful shutdown handling
const SHUTDOWN_TIMEOUT_MS = 4000;
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  const shutdownTimer = setTimeout(() => {
    console.error('Graceful shutdown timeout. Forcing exit...');
    for (const socket of activeConnections) {
      socket.destroy();
    }
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  shutdownTimer.unref();

  const ioClosePromise = new Promise<void>((resolve) => {
    io.close(() => {
      console.log('Socket.IO connections closed');
      resolve();
    });
  });

  const serverClosePromise = new Promise<void>((resolve) => {
    httpServer.close((err?: Error) => {
      if (err && !(err as NodeJS.ErrnoException).code?.includes('ERR_SERVER_NOT_RUNNING')) {
        console.error('Error while closing HTTP server:', err.message);
      } else {
        console.log('HTTP server closed');
      }
      resolve();
    });

    httpServer.closeIdleConnections();
    httpServer.closeAllConnections();
  });

  await Promise.allSettled([ioClosePromise, serverClosePromise]);

  // Ensure remaining sockets are destroyed after close attempts.
  for (const socket of activeConnections) {
    socket.destroy();
  }

  try {
    await prisma.$disconnect();
    console.log('Database disconnected');
  } catch (err) {
    console.error('Error disconnecting database:', err);
  }

  clearTimeout(shutdownTimer);
  console.log('Graceful shutdown complete');
  process.exit(0);
};

process.once('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
process.once('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

export { app, httpServer, io };
