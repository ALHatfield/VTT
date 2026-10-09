// Play-area lighting routes — Phase PM4
import { Router } from 'express';

import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireCampaignRole } from '../campaigns/campaigns.middleware.js';
import { getSceneLighting } from './lighting.service.js';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/campaigns/:id/scenes/:sceneId/lighting
 * Authored + temporary lights for rendering — any campaign member.
 */
router.get(
  '/:id/scenes/:sceneId/lighting',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const lighting = await getSceneLighting(req.params.id, req.params.sceneId);
    if (!lighting) {
      res.status(404).json({ error: { code: 'SCENE_NOT_FOUND', message: 'Scene not found' } });
      return;
    }
    res.status(200).json({ data: lighting });
  }),
);

export { router as lightingRouter };
