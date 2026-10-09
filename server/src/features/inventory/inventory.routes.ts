import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';

/**
 * Inventory routes — item catalog, character inventory, party loot (Phase 10A+)
 */
const router = Router();

router.use(requireAuth);

export { router as inventoryRouter };
