import { Router } from 'express';
import { prisma } from '../../shared/db/prisma.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

const router = Router();

/**
 * GET /api/dev/users
 * Return all seeded users for dev user switcher
 * DEV ONLY - Never enable in production
 */
router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
      },
      orderBy: { email: 'asc' },
    });

    res.status(200).json({ users });
  }),
);

/**
 * POST /api/dev/login
 * Auto-login as a specific user by ID (skips password check)
 * DEV ONLY - Never enable in production
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        error: { code: 'MISSING_USER_ID', message: 'userId is required' },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    // Create session for this user (bypass password check)
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.username = user.username;

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  }),
);

export { router as devRouter };
