import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';

/**
 * Bestiary routes — creature library, creature tokens, import/export (Phase 8A+)
 */
const router = Router();

router.use(requireAuth);

export { router as bestiaryRouter };
