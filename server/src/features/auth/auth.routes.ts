import { loginPayloadSchema, SESSION_COOKIE_NAME } from '@vtt/shared';
import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from './auth.middleware.js';
import { authenticateUser, getUserById } from './auth.service.js';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    // Validate request body
    const result = loginPayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'validation_error',
        message: 'Invalid login credentials',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password } = result.data;

    try {
      // Authenticate user
      const user = await authenticateUser(email, password);

      // Store user data in session
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.username = user.username;

      res.status(200).json({ user });
    } catch (err) {
      // Generic error to prevent account enumeration
      res.status(401).json({
        error: 'authentication_failed',
        message: 'Invalid username or password',
      });
    }
  }),
);

/**
 * POST /api/auth/logout
 * Destroy session and clear cookie
 */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({
          error: 'logout_failed',
          message: 'Failed to log out',
        });
        return;
      }

      res.clearCookie(SESSION_COOKIE_NAME);
      res.status(204).send();
    });
  }),
);

/**
 * GET /api/auth/me
 * Get current user from session
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const user = await getUserById(userId);

    if (!user) {
      res.status(404).json({
        error: 'user_not_found',
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({ user });
  }),
);

export { router as authRouter };
