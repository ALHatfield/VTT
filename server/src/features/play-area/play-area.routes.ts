import { Router } from 'express';

import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';

/**
 * PlayArea routes — Phase 4F.1
 */
const router = Router();

router.use(requireAuth);

export { router as playAreaRouter };
