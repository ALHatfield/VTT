import { Router } from 'express';

import type {
  FogConfigUpdatedPayload,
  FogExplorationSyncPayload,
  FogHiddenPayload,
  FogRevealedPayload,
} from '@vtt/shared';
import {
  FOG_CONFIG_EVENTS,
  FOG_EVENTS,
  fogHidePayloadSchema,
  fogMaskConfigPatchSchema,
  fogRevealPayloadSchema,
} from '@vtt/shared';

import { getIo } from '../../shared/socket/io-instance.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireCampaignRole } from '../campaigns/campaigns.middleware.js';
import { getSceneFogConfig, updateSceneFogConfig } from './fog-config.service.js';
import { clearExploration, listExploration } from './fog-exploration.service.js';
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

    getIo()
      ?.to(`campaign:${campaignId}`)
      .emit(FOG_EVENTS.FOG_REVEALED, {
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

    getIo()
      ?.to(`campaign:${campaignId}`)
      .emit(FOG_EVENTS.FOG_HIDDEN, {
        removedRegionIds,
        campaignId,
        sceneId,
      } satisfies FogHiddenPayload);

    res.status(200).json({ data: { removedRegionIds } });
  }),
);

/**
 * GET /api/campaigns/:id/scenes/:sceneId/fog/config
 * Returns the effective PM2 fog mask configuration for the scene.
 */
router.get(
  '/:id/scenes/:sceneId/fog/config',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId } = req.params;
    const config = await getSceneFogConfig(sceneId, campaignId);
    res.status(200).json({ data: config });
  }),
);

/**
 * PATCH /api/campaigns/:id/scenes/:sceneId/fog/config
 * DM updates one or more PM2 fog mask settings.
 */
router.patch(
  '/:id/scenes/:sceneId/fog/config',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId } = req.params;

    const parsed = fogMaskConfigPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid fog config payload',
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const config = await updateSceneFogConfig(sceneId, campaignId, parsed.data);

    getIo()
      ?.to(`campaign:${campaignId}`)
      .emit(FOG_CONFIG_EVENTS.FOG_CONFIG_UPDATED, {
        campaignId,
        sceneId,
        config,
      } satisfies FogConfigUpdatedPayload);

    res.status(200).json({ data: config });
  }),
);

/**
 * GET /api/campaigns/:id/scenes/:sceneId/fog/exploration
 * Returns persisted explored stamps so reconnecting clients rehydrate fog parity.
 * Observers receive nothing — same gate as vision sync.
 */
router.get(
  '/:id/scenes/:sceneId/fog/exploration',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId } = req.params;

    if (req.campaignRole === 'observer') {
      res.status(200).json({ data: [] });
      return;
    }

    const stamps = await listExploration(sceneId, campaignId);
    res.status(200).json({ data: stamps });
  }),
);

/**
 * DELETE /api/campaigns/:id/scenes/:sceneId/fog/exploration
 * DM resets exploration memory for the scene.
 */
router.delete(
  '/:id/scenes/:sceneId/fog/exploration',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId } = req.params;
    await clearExploration(sceneId, campaignId);

    getIo()
      ?.to(`campaign:${campaignId}`)
      .emit(FOG_CONFIG_EVENTS.FOG_EXPLORATION_SYNC, {
        campaignId,
        sceneId,
        mode: 'replace',
        stamps: [],
      } satisfies FogExplorationSyncPayload);

    res.status(204).send();
  }),
);

export { router as fogRouter };
