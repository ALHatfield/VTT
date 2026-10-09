import type {
    CharacterAssignmentChangedPayload,
    CharacterLinkUpdatedPayload,
    TokenUpdatedPayload,
} from '@vtt/shared';
import {
    CHARACTER_EVENTS,
    PLAY_AREA_EVENTS,
    characterAssignmentPayloadSchema,
    characterLinkPayloadSchema,
} from '@vtt/shared';
import { Router } from 'express';

import { getIo } from '../../shared/socket/io-instance.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireCampaignRole } from '../campaigns/campaigns.middleware.js';
import {
    assignCharacter,
    linkCharacterToken,
    listCharacterTokens,
    unlinkCharacterToken,
} from './character-tokens.service.js';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/campaigns/:id/character-tokens
 * List all character-token links in a campaign (any member)
 */
router.get(
  '/:id/character-tokens',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const links = await listCharacterTokens(req.params.id);
    res.status(200).json({ data: links });
  }),
);

/**
 * POST /api/campaigns/:id/character-tokens
 * Link a character to a token (DM: any; player: own character to own token)
 */
router.post(
  '/:id/character-tokens',
  requireCampaignRole('player'),
  asyncHandler(async (req, res) => {
    const result = characterLinkPayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid link data',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const campaignId = req.params.id;
    const { link, token } = await linkCharacterToken(
      campaignId,
      result.data.characterId,
      result.data.tokenId,
      req.session.userId!,
      req.campaignRole!,
    );

    const io = getIo();
    io?.to(`campaign:${campaignId}`).emit(CHARACTER_EVENTS.LINK_UPDATED, {
      campaignId,
      characterId: link.characterId,
      tokenId: link.tokenId,
      linked: true,
    } satisfies CharacterLinkUpdatedPayload);
    io?.to(`campaign:${campaignId}`).emit(PLAY_AREA_EVENTS.TOKEN_UPDATED, {
      token,
      campaignId,
    } satisfies TokenUpdatedPayload);

    res.status(201).json({ data: link });
  }),
);

/**
 * DELETE /api/campaigns/:id/character-tokens/:linkId
 * Unlink a character from a token (DM or character owner)
 */
router.delete(
  '/:id/character-tokens/:linkId',
  requireCampaignRole('player'),
  asyncHandler(async (req, res) => {
    const campaignId = req.params.id;
    const link = await unlinkCharacterToken(
      campaignId,
      req.params.linkId,
      req.session.userId!,
      req.campaignRole!,
    );

    getIo()?.to(`campaign:${campaignId}`).emit(CHARACTER_EVENTS.LINK_UPDATED, {
      campaignId,
      characterId: link.characterId,
      tokenId: link.tokenId,
      linked: false,
    } satisfies CharacterLinkUpdatedPayload);

    res.status(204).send();
  }),
);

/**
 * POST /api/campaigns/:id/characters/:charId/assign
 * Assign a character to a user and auto-link their player token
 * (DM: anyone; players: themselves only)
 */
router.post(
  '/:id/characters/:charId/assign',
  requireCampaignRole('player'),
  asyncHandler(async (req, res) => {
    const result = characterAssignmentPayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid assignment data',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    if (req.campaignRole !== 'dm' && result.data.userId !== req.session.userId) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You can only assign characters to yourself' },
      });
      return;
    }

    const campaignId = req.params.id;
    const assignment = await assignCharacter(
      campaignId,
      req.params.charId,
      result.data.userId,
      req.session.userId!,
      req.campaignRole!,
    );

    const io = getIo();
    io?.to(`campaign:${campaignId}`).emit(CHARACTER_EVENTS.ASSIGNMENT_CHANGED, {
      campaignId,
      characterId: assignment.characterId,
      userId: assignment.userId,
      previousUserId: assignment.previousUserId,
    } satisfies CharacterAssignmentChangedPayload);

    // Auto-link side effects: new link + token display changed
    if (assignment.link && assignment.token) {
      io?.to(`campaign:${campaignId}`).emit(CHARACTER_EVENTS.LINK_UPDATED, {
        campaignId,
        characterId: assignment.link.characterId,
        tokenId: assignment.link.tokenId,
        linked: true,
      } satisfies CharacterLinkUpdatedPayload);
      io?.to(`campaign:${campaignId}`).emit(PLAY_AREA_EVENTS.TOKEN_UPDATED, {
        token: assignment.token,
        campaignId,
      } satisfies TokenUpdatedPayload);
    }

    res.status(200).json({
      data: {
        characterId: assignment.characterId,
        userId: assignment.userId,
        previousUserId: assignment.previousUserId,
      },
    });
  }),
);

export { router as characterTokensRouter };
