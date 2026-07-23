import {
    characterCreatePayloadSchema,
    characterHpUpdatePayloadSchema,
    characterUpdatePayloadSchema,
} from '@vtt/shared';
import { Router } from 'express';

import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireCampaignRole } from '../campaigns/campaigns.middleware.js';
import {
    createCharacter,
    deleteCharacter,
    getCharacter,
    listCharacters,
    updateCharacter,
    updateCharacterHp,
} from './characters.service.js';

const router = Router();

// All character routes require authentication
router.use(requireAuth);

/**
 * GET /api/campaigns/:id/characters
 * List all characters in a campaign (any member)
 */
router.get(
  '/:id/characters',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const characters = await listCharacters(req.params.id);
    res.status(200).json({ data: characters });
  }),
);

/**
 * POST /api/campaigns/:id/characters
 * Create a new character (player or DM)
 */
router.post(
  '/:id/characters',
  requireCampaignRole('player'),
  asyncHandler(async (req, res) => {
    const result = characterCreatePayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid character data',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const character = await createCharacter(
      req.params.id,
      req.session.userId!,
      result.data,
    );
    res.status(201).json({ data: character });
  }),
);

/**
 * GET /api/campaigns/:id/characters/:charId
 * Get character detail (any member)
 */
router.get(
  '/:id/characters/:charId',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const character = await getCharacter(req.params.id, req.params.charId);
    if (!character) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Character not found',
        },
      });
      return;
    }
    res.status(200).json({ data: character });
  }),
);

/**
 * PUT /api/campaigns/:id/characters/:charId
 * Update a character (owner or DM)
 */
router.put(
  '/:id/characters/:charId',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    // Verify ownership: only the character owner or the DM can update
    const existing = await getCharacter(req.params.id, req.params.charId);
    if (!existing) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Character not found' },
      });
      return;
    }

    const isDm = req.campaignRole === 'dm';
    const isOwner = existing.userId === req.session.userId;
    if (!isDm && !isOwner) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You can only edit your own characters' },
      });
      return;
    }

    const result = characterUpdatePayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid character data',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const updated = await updateCharacter(req.params.id, req.params.charId, result.data);
    res.status(200).json({ data: updated });
  }),
);

/**
 * PATCH /api/campaigns/:id/characters/:charId/hp
 * Quick HP update (owner or DM)
 */
router.patch(
  '/:id/characters/:charId/hp',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const existing = await getCharacter(req.params.id, req.params.charId);
    if (!existing) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Character not found' },
      });
      return;
    }

    const isDm = req.campaignRole === 'dm';
    const isOwner = existing.userId === req.session.userId;
    if (!isDm && !isOwner) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You can only edit your own characters' },
      });
      return;
    }

    const result = characterHpUpdatePayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid HP data',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    // Ensure HP does not exceed the character's maxHp
    if (result.data.hp > existing.maxHp) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `HP cannot exceed max HP (${existing.maxHp})`,
        },
      });
      return;
    }

    const updated = await updateCharacterHp(req.params.id, req.params.charId, result.data.hp);
    res.status(200).json({ data: updated });
  }),
);

/**
 * DELETE /api/campaigns/:id/characters/:charId
 * Delete a character (DM only)
 */
router.delete(
  '/:id/characters/:charId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const deleted = await deleteCharacter(req.params.id, req.params.charId);
    if (!deleted) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Character not found' },
      });
      return;
    }
    res.status(204).send();
  }),
);

export { router as characterRouter };
