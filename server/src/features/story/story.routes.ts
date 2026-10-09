import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';

/**
 * Story routes — journal, handouts, quests (Phase 7A+)
 */
const router = Router();

router.use(requireAuth);

export { router as storyRouter };
