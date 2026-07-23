import type { FogHiddenPayload, FogRevealedPayload } from '@vtt/shared';
import { FOG_EVENTS, fogHidePayloadSchema, fogRevealPayloadSchema } from '@vtt/shared';
import { Router } from 'express';

import { getIo } from '../../shared/socket/io-instance.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireCampaignRole } from '../campaigns/campaigns.middleware.js';
import { hideFogByPolygon, listFogRegions, revealFogRegion } from './fog.service.js';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/campaigns/:id/scenes/:sceneId/fog
 * Returns the revealed fog polygons for the scene.
 */
router.get(
  '/:id/scenes/:sceneId/fog',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId } = req.params;
    const role = req.campaignRole;

    if (!role) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const regions = await listFogRegions(sceneId, campaignId, role);
    res.status(200).json({ data: regions });
  }),
);

/**
 * POST /api/campaigns/:id/scenes/:sceneId/fog/reveal
 * DM reveals a fog region polygon.
 */
router.post(
  '/:id/scenes/:sceneId/fog/reveal',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId } = req.params;
    const userId = req.session.userId;

    if (!userId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const parsed = fogRevealPayloadSchema.safeParse({
      campaignId,
      sceneId,
      vertices: (req.body as { vertices?: unknown }).vertices,
    });

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid fog reveal payload',
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const region = await revealFogRegion(sceneId, campaignId, userId, parsed.data.vertices);

    getIo()?.to(`campaign:${campaignId}`).emit(FOG_EVENTS.FOG_REVEALED, {
      region,
      campaignId,
      sceneId,
    } satisfies FogRevealedPayload);

    res.status(201).json({ data: region });
  }),
);

/**
 * POST /api/campaigns/:id/scenes/:sceneId/fog/hide
 * DM hides fog by providing a polygon mask (removes overlapping revealed regions).
 */
router.post(
  '/:id/scenes/:sceneId/fog/hide',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId } = req.params;

    const parsed = fogHidePayloadSchema.safeParse({
      campaignId,
      sceneId,
      vertices: (req.body as { vertices?: unknown }).vertices,
    });

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid fog hide payload',
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const removedRegionIds = await hideFogByPolygon(sceneId, campaignId, parsed.data.vertices);

    getIo()?.to(`campaign:${campaignId}`).emit(FOG_EVENTS.FOG_HIDDEN, {
      removedRegionIds,
      campaignId,
      sceneId,
    } satisfies FogHiddenPayload);

    res.status(200).json({ data: { removedRegionIds } });
  }),
);

export { router as fogRouter };

