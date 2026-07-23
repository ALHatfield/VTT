import type { TokenCreatedPayload, TokenDeletedPayload, TokenMovedPayload, TokenUpdatedPayload } from '@vtt/shared';
import { PLAY_AREA_EVENTS, tokenCreatePayloadSchema, tokenMovePayloadSchema, tokenUpdatePayloadSchema } from '@vtt/shared';
import { Router } from 'express';

import { getIo } from '../../shared/socket/io-instance.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireCampaignRole } from '../campaigns/campaigns.middleware.js';
import {
    createToken,
    deleteToken,
    getOrCreateActiveScene,
    listTokens,
    moveToken,
    updateToken
} from './tokens.service.js';
import { emitVisionSync } from './vision.service.js';

const router = Router();

// All play-area token routes require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

/**
 * GET /api/campaigns/:id/scenes/active
 * Return the active scene for the campaign, auto-creating a default one if needed.
 */
router.get(
  '/:id/scenes/active',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const scene = await getOrCreateActiveScene(req.params.id);
    res.status(200).json({ data: scene });
  }),
);

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * GET /api/campaigns/:id/scenes/:sceneId/tokens
 * List all tokens on a scene (all campaign members).
 */
router.get(
  '/:id/scenes/:sceneId/tokens',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId } = req.params;
    const tokens = await listTokens(sceneId, campaignId);
    res.status(200).json({ data: tokens });
  }),
);

/**
 * POST /api/campaigns/:id/scenes/:sceneId/tokens
 * Create a token on a scene (DM only).
 */
router.post(
  '/:id/scenes/:sceneId/tokens',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = tokenCreatePayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid token data',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { id: campaignId, sceneId } = req.params;
    const token = await createToken(sceneId, campaignId, result.data);

    const ioForCreate = getIo();
    ioForCreate?.to(`campaign:${campaignId}`).emit(PLAY_AREA_EVENTS.TOKEN_CREATED, {
      token,
      campaignId,
    } satisfies TokenCreatedPayload);

    if (ioForCreate) {
      emitVisionSync(ioForCreate, campaignId, sceneId).catch((err: unknown) => {
        console.error('[tokens.routes] vision:sync error after token create', err);
      });
    }

    res.status(201).json({ data: token });
  }),
);

/**
 * PUT /api/campaigns/:id/scenes/:sceneId/tokens/:tokenId
 * Update a token's properties. DM can update any token; Player can update their own only.
 */
router.put(
  '/:id/scenes/:sceneId/tokens/:tokenId',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const result = tokenUpdatePayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid token data',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { id: campaignId, sceneId, tokenId } = req.params;
    const userId = req.session.userId;
    const userRole = req.campaignRole;
    if (!userId || !userRole) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }
    const token = await updateToken(
      tokenId,
      sceneId,
      campaignId,
      result.data,
      userId,
      userRole,
    );

    getIo()?.to(`campaign:${campaignId}`).emit(PLAY_AREA_EVENTS.TOKEN_UPDATED, {
      token,
      campaignId,
    } satisfies TokenUpdatedPayload);

    // Emit role-gated vision sync when token properties (including visionRadius) change
    const io = getIo();
    if (io) {
      emitVisionSync(io, campaignId, sceneId).catch((err: unknown) => {
        console.error('[tokens.routes] vision:sync error after token update', err);
      });
    }

    res.status(200).json({ data: token });
  }),
);

/**
 * PATCH /api/campaigns/:id/scenes/:sceneId/tokens/:tokenId/position
 * Move a token to a new grid position. DM can move any; Player can move their own only.
 */
router.patch(
  '/:id/scenes/:sceneId/tokens/:tokenId/position',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const result = tokenMovePayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid position data',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { id: campaignId, sceneId, tokenId } = req.params;
    const userId = req.session.userId;
    const userRole = req.campaignRole;
    if (!userId || !userRole) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }
    const token = await moveToken(
      tokenId,
      sceneId,
      campaignId,
      result.data.x,
      result.data.y,
      userId,
      userRole,
    );

    const ioForMove = getIo();
    ioForMove?.to(`campaign:${campaignId}`).emit(PLAY_AREA_EVENTS.TOKEN_MOVED, {
      tokenId: token.id,
      x: token.x,
      y: token.y,
      campaignId,
      userId,
    } satisfies TokenMovedPayload);

    if (ioForMove) {
      emitVisionSync(ioForMove, campaignId, sceneId).catch((err: unknown) => {
        console.error('[tokens.routes] vision:sync error after token move', err);
      });
    }

    res.status(200).json({ data: token });
  }),
);

/**
 * DELETE /api/campaigns/:id/scenes/:sceneId/tokens/:tokenId
 * Delete a token (DM only).
 */
router.delete(
  '/:id/scenes/:sceneId/tokens/:tokenId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const { id: campaignId, sceneId, tokenId } = req.params;
    await deleteToken(tokenId, sceneId, campaignId);

    const ioForDelete = getIo();
    ioForDelete?.to(`campaign:${campaignId}`).emit(PLAY_AREA_EVENTS.TOKEN_DELETED, {
      tokenId,
      campaignId,
    } satisfies TokenDeletedPayload);

    if (ioForDelete) {
      emitVisionSync(ioForDelete, campaignId, sceneId).catch((err: unknown) => {
        console.error('[tokens.routes] vision:sync error after token delete', err);
      });
    }

    res.status(204).send();
  }),
);

export { router as playAreaRouter };

