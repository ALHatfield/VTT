import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';

/**
 * Dice routes — macros, dice skins, roll history and stats (Phase 9C+)
 */
const router = Router();

router.use(requireAuth);

export { router as diceRouter };
