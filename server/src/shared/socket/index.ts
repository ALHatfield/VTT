import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Server } from 'socket.io';

import { registerPlayAreaHandlers } from '../../features/play-area/play-area.socket.js';

/**
 * Configures Socket.IO authentication and registers all feature event handlers.
 *
 * Authentication uses the shared Express session middleware so socket connections
 * are validated against the same PostgreSQL session store as REST requests.
 *
 * @param io - The Socket.IO server instance
 * @param sessionMiddleware - The Express session middleware to share with Socket.IO
 */
export function setupSocket(io: Server, sessionMiddleware: RequestHandler): void {
  // Share Express session with Socket.IO handshake
  io.use((socket, next) => {
    sessionMiddleware(socket.request as Request, {} as Response, next as NextFunction);
  });

  // Reject unauthenticated connections
  io.use((socket, next) => {
    const req = socket.request as Request;
    if (!req.session?.userId) {
      return next(new Error('Authentication required'));
    }
    socket.data.userId = req.session.userId;
    socket.data.username = req.session.username ?? 'Unknown';
    next();
  });

  io.on('connection', (socket) => {
    registerPlayAreaHandlers(io, socket);
  });
}
