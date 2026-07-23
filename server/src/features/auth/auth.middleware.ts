import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware to require authentication
 * Validates that a user session exists
 * Returns 401 if not authenticated
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session.userId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return;
  }

  next();
}
