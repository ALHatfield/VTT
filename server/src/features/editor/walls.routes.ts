// Wall segment routes — Phase 5F
// Mounted at app.use('/api/campaigns', wallsRouter). All routes are DM-only.
import type { Response } from 'express';
import { Router } from 'express';

import type { WallsUpdatedPayload } from '@vtt/shared';
import { EDITOR_EVENTS, wallSegmentCreateSchema, wallSegmentUpdateSchema } from '@vtt/shared';

import { getIo } from '../../shared/socket/io-instance.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireCampaignRole } from '../campaigns/campaigns.middleware.js';
import type { WallErrorCode } from './walls.service.js';
import {
    WallServiceError,
    createWall,
    deleteAllWalls,
    deleteWall,
    listWalls,
    updateWall,
} from './walls.service.js';

const WALL_ERROR_STATUS: Record<WallErrorCode, number> = {
  SCENE_NOT_FOUND: 404,
  WALL_LIMIT_REACHED: 409,
  DEGENERATE_WALL: 400,
  INVALID_DOOR_STATE: 400,
};

const router = Router();

router.use(requireAuth);

function broadcastWallsUpdated(campaignId: string, sceneId: string): void {
  getIo()
    ?.to(`campaign:${campaignId}`)
    .emit(EDITOR_EVENTS.WALLS_UPDATED, { campaignId, sceneId } satisfies WallsUpdatedPayload);
}

/** Send a structured response for known service errors; returns false for unknown errors. */
function sendWallError(res: Response, err: unknown): boolean {
  if (!(err instanceof WallServiceError)) return false;
  res.status(WALL_ERROR_STATUS[err.code]).json({ error: { code: err.code, message: err.message } });
  return true;
}

/**
 * GET /api/campaigns/:id/scenes/:sceneId/walls
 * List wall segments on a scene — DM only
 */
router.get(
  '/:id/scenes/:sceneId/walls',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    try {
      const walls = await listWalls(req.params.id, req.params.sceneId);
      res.status(200).json({ data: walls });
    } catch (err) {
      if (!sendWallError(res, err)) throw err;
    }
  }),
);

/**
 * POST /api/campaigns/:id/scenes/:sceneId/walls
 * Create a wall segment — DM only
 */
router.post(
  '/:id/scenes/:sceneId/walls',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = wallSegmentCreateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid wall payload',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { id: campaignId, sceneId } = req.params;
    try {
      const wall = await createWall(campaignId, sceneId, result.data);
      broadcastWallsUpdated(campaignId, sceneId);
      res.status(201).json({ data: wall });
    } catch (err) {
      if (!sendWallError(res, err)) throw err;
    }
  }),
);

/**
 * DELETE /api/campaigns/:id/scenes/:sceneId/walls
 * Bulk delete every wall segment on a scene — DM only
 */
router.delete(
  '/:id/scenes/:sceneId/walls',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId } = req.params;
    try {
      const deletedCount = await deleteAllWalls(campaignId, sceneId);
      if (deletedCount > 0) broadcastWallsUpdated(campaignId, sceneId);
      res.status(200).json({ data: { deletedCount } });
    } catch (err) {
      if (!sendWallError(res, err)) throw err;
    }
  }),
);

/**
 * PATCH /api/campaigns/:id/scenes/:sceneId/walls/:wallId
 * Update a wall segment (endpoints, blocking flags, door state) — DM only
 */
router.patch(
  '/:id/scenes/:sceneId/walls/:wallId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = wallSegmentUpdateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid wall update payload',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { id: campaignId, sceneId, wallId } = req.params;
    try {
      const wall = await updateWall(campaignId, sceneId, wallId, result.data);
      if (!wall) {
        res.status(404).json({ error: { code: 'WALL_NOT_FOUND', message: 'Wall not found' } });
        return;
      }
      broadcastWallsUpdated(campaignId, sceneId);
      res.status(200).json({ data: wall });
    } catch (err) {
      if (!sendWallError(res, err)) throw err;
    }
  }),
);

/**
 * DELETE /api/campaigns/:id/scenes/:sceneId/walls/:wallId
 * Delete a single wall segment — DM only
 */
router.delete(
  '/:id/scenes/:sceneId/walls/:wallId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId, wallId } = req.params;
    const deleted = await deleteWall(campaignId, sceneId, wallId);
    if (!deleted) {
      res.status(404).json({ error: { code: 'WALL_NOT_FOUND', message: 'Wall not found' } });
      return;
    }
    broadcastWallsUpdated(campaignId, sceneId);
    res.status(204).send();
  }),
);

export { router as wallsRouter };
