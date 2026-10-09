// Light source + scene atmosphere routes — Phase 5G
// Mounted at app.use('/api/campaigns', lightsRouter). All routes are DM-only.
import type { Response } from 'express';
import { Router } from 'express';

import type { LightsUpdatedPayload } from '@vtt/shared';
import {
    EDITOR_EVENTS,
    lightSourceCreateSchema,
    lightSourceUpdateSchema,
    sceneAtmosphereUpdateSchema,
} from '@vtt/shared';

import { getIo } from '../../shared/socket/io-instance.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireCampaignRole } from '../campaigns/campaigns.middleware.js';
import type { LightErrorCode } from './lights.service.js';
import {
    LightServiceError,
    createLight,
    deleteLight,
    getSceneAtmosphere,
    listLights,
    updateLight,
    updateSceneAtmosphere,
} from './lights.service.js';

const LIGHT_ERROR_STATUS: Record<LightErrorCode, number> = {
  SCENE_NOT_FOUND: 404,
  LIGHT_LIMIT_REACHED: 409,
};

const router = Router();

router.use(requireAuth);

function broadcastLightsUpdated(campaignId: string, sceneId: string): void {
  getIo()
    ?.to(`campaign:${campaignId}`)
    .emit(EDITOR_EVENTS.LIGHTS_UPDATED, { campaignId, sceneId } satisfies LightsUpdatedPayload);
}

/** Send a structured response for known service errors; returns false for unknown errors. */
function sendLightError(res: Response, err: unknown): boolean {
  if (!(err instanceof LightServiceError)) return false;
  res.status(LIGHT_ERROR_STATUS[err.code]).json({ error: { code: err.code, message: err.message } });
  return true;
}

function sendValidationError(res: Response, message: string, details: unknown): void {
  res.status(400).json({ error: { code: 'VALIDATION_ERROR', message, details } });
}

/**
 * GET /api/campaigns/:id/scenes/:sceneId/lights
 * List authored lights on a scene — DM only
 */
router.get(
  '/:id/scenes/:sceneId/lights',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    try {
      const lights = await listLights(req.params.id, req.params.sceneId);
      res.status(200).json({ data: lights });
    } catch (err) {
      if (!sendLightError(res, err)) throw err;
    }
  }),
);

/**
 * POST /api/campaigns/:id/scenes/:sceneId/lights
 * Create a light from a preset (with optional overrides) — DM only
 */
router.post(
  '/:id/scenes/:sceneId/lights',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = lightSourceCreateSchema.safeParse(req.body);
    if (!result.success) {
      sendValidationError(res, 'Invalid light payload', result.error.flatten().fieldErrors);
      return;
    }

    const { id: campaignId, sceneId } = req.params;
    try {
      const light = await createLight(campaignId, sceneId, result.data);
      broadcastLightsUpdated(campaignId, sceneId);
      res.status(201).json({ data: light });
    } catch (err) {
      if (!sendLightError(res, err)) throw err;
    }
  }),
);

/**
 * PATCH /api/campaigns/:id/scenes/:sceneId/lights/:lightId
 * Update a light's position or properties — DM only
 */
router.patch(
  '/:id/scenes/:sceneId/lights/:lightId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = lightSourceUpdateSchema.safeParse(req.body);
    if (!result.success) {
      sendValidationError(res, 'Invalid light update payload', result.error.flatten().fieldErrors);
      return;
    }

    const { id: campaignId, sceneId, lightId } = req.params;
    const light = await updateLight(campaignId, sceneId, lightId, result.data);
    if (!light) {
      res.status(404).json({ error: { code: 'LIGHT_NOT_FOUND', message: 'Light not found' } });
      return;
    }
    broadcastLightsUpdated(campaignId, sceneId);
    res.status(200).json({ data: light });
  }),
);

/**
 * DELETE /api/campaigns/:id/scenes/:sceneId/lights/:lightId
 * Delete a single light — DM only
 */
router.delete(
  '/:id/scenes/:sceneId/lights/:lightId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId, lightId } = req.params;
    const deleted = await deleteLight(campaignId, sceneId, lightId);
    if (!deleted) {
      res.status(404).json({ error: { code: 'LIGHT_NOT_FOUND', message: 'Light not found' } });
      return;
    }
    broadcastLightsUpdated(campaignId, sceneId);
    res.status(204).send();
  }),
);

/**
 * GET /api/campaigns/:id/scenes/:sceneId/atmosphere
 * Read the scene's default weather preset — DM only
 */
router.get(
  '/:id/scenes/:sceneId/atmosphere',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    try {
      const atmosphere = await getSceneAtmosphere(req.params.id, req.params.sceneId);
      res.status(200).json({ data: atmosphere });
    } catch (err) {
      if (!sendLightError(res, err)) throw err;
    }
  }),
);

/**
 * PATCH /api/campaigns/:id/scenes/:sceneId/atmosphere
 * Set the scene's default weather preset (rendered by play-area PM5) — DM only
 */
router.patch(
  '/:id/scenes/:sceneId/atmosphere',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = sceneAtmosphereUpdateSchema.safeParse(req.body);
    if (!result.success) {
      sendValidationError(res, 'Invalid atmosphere payload', result.error.flatten().fieldErrors);
      return;
    }

    try {
      const atmosphere = await updateSceneAtmosphere(
        req.params.id,
        req.params.sceneId,
        result.data.weatherPreset,
      );
      res.status(200).json({ data: atmosphere });
    } catch (err) {
      if (!sendLightError(res, err)) throw err;
    }
  }),
);

export { router as lightsRouter };
