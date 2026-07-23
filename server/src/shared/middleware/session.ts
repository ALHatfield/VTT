import { DEFAULT_SESSION_MAX_AGE, SESSION_COOKIE_NAME } from '@vtt/shared';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { env } from '../utils/env.js';

const PgStore = connectPgSimple(session);

/**
 * Session middleware configuration
 * Uses PostgreSQL for session storage via connect-pg-simple
 */
export const sessionMiddleware = session({
  store: new PgStore({
    // Use Prisma's connection string
    conString: env.DATABASE_URL,
    // Reuse Prisma's table name
    tableName: 'session',
    // Clean up expired sessions daily
    pruneSessionInterval: 24 * 60 * 60,
  }),
  secret: env.SESSION_SECRET,
  name: SESSION_COOKIE_NAME,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: DEFAULT_SESSION_MAX_AGE,
  },
});
