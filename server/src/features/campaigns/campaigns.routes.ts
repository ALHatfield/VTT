import type { TokenCreatedPayload } from '@vtt/shared';
import { campaignCreatePayloadSchema, campaignInvitePayloadSchema, campaignUpdatePayloadSchema, PLAY_AREA_EVENTS } from '@vtt/shared';
import { Router } from 'express';

import { getIo } from '../../shared/socket/io-instance.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { createPlayerTokenForMember } from '../play-area/tokens.service.js';
import { requireCampaignRole } from './campaigns.middleware.js';
import {
    createCampaign,
    deleteCampaign,
    getCampaignWithMembers,
    inviteMember,
    leaveCampaign,
    listCampaignsForUser,
    removeMember,
    updateCampaign,
} from './campaigns.service.js';

const router = Router();

// All campaign routes require authentication
router.use(requireAuth);

/**
 * GET /api/campaigns
 * List all campaigns the authenticated user belongs to
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const campaigns = await listCampaignsForUser(req.session.userId!);
    res.status(200).json({ data: campaigns });
  }),
);

/**
 * POST /api/campaigns
 * Create a new campaign — creator becomes DM
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = campaignCreatePayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid campaign data',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { name, description } = result.data;
    const campaign = await createCampaign(req.session.userId!, name, description);
    res.status(201).json({ data: campaign });
  }),
);

/**
 * GET /api/campaigns/:id
 * Get campaign detail with member list (members only)
 */
router.get(
  '/:id',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const campaignId = req.params.id;
    const campaignWithMembers = await getCampaignWithMembers(campaignId);

    if (!campaignWithMembers) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        },
      });
      return;
    }

    // Overlay the real role from the membership middleware
    const response = {
      ...campaignWithMembers,
      role: req.campaignRole!,
    };

    res.status(200).json({ data: response });
  }),
);

/**
 * PUT /api/campaigns/:id
 * Update campaign name/description (DM only)
 */
router.put(
  '/:id',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = campaignUpdatePayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid campaign data',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const campaign = await updateCampaign(req.params.id, result.data);
    // Re-attach the user's role from middleware
    res.status(200).json({ data: { ...campaign, role: req.campaignRole! } });
  }),
);

/**
 * DELETE /api/campaigns/:id
 * Delete campaign and all related data (DM only)
 */
router.delete(
  '/:id',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    await deleteCampaign(req.params.id);
    res.status(204).send();
  }),
);

/**
 * POST /api/campaigns/:id/invite
 * DM invites a user by email with a given role (player or observer)
 */
router.post(
  '/:id/invite',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = campaignInvitePayloadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid invite data',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    try {
      const { member, invitedUserId, invitedUsername } = await inviteMember(req.params.id, result.data.email, result.data.role);

      if (result.data.role === 'player') {
        const token = await createPlayerTokenForMember(req.params.id, invitedUserId, invitedUsername);
        getIo()?.to(`campaign:${req.params.id}`).emit(PLAY_AREA_EVENTS.TOKEN_CREATED, {
          token,
          campaignId: req.params.id,
        } satisfies TokenCreatedPayload);
      }

      res.status(201).json({ data: member });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'USER_NOT_FOUND') {
        // Return a generic message to prevent email enumeration (OWASP A07)
        res.status(422).json({ error: { code: 'INVITE_FAILED', message: 'Invitation could not be sent — check the email address and try again' } });
        return;
      }
      if (code === 'ALREADY_MEMBER') {
        res.status(409).json({ error: { code, message: (err as Error).message } });
        return;
      }
      throw err;
    }
  }),
);

/**
 * DELETE /api/campaigns/:id/members/:userId
 * DM removes a member from the campaign
 */
router.delete(
  '/:id/members/:userId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    try {
      await removeMember(req.params.id, req.params.userId);
      res.status(204).send();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'NOT_FOUND') {
        res.status(404).json({ error: { code, message: (err as Error).message } });
        return;
      }
      if (code === 'CANNOT_REMOVE_DM') {
        res.status(403).json({ error: { code, message: (err as Error).message } });
        return;
      }
      throw err;
    }
  }),
);

/**
 * POST /api/campaigns/:id/leave
 * Authenticated member voluntarily leaves the campaign (DM cannot leave)
 */
router.post(
  '/:id/leave',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    try {
      await leaveCampaign(req.params.id, req.session.userId!);
      res.status(204).send();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'DM_CANNOT_LEAVE') {
        res.status(403).json({ error: { code, message: (err as Error).message } });
        return;
      }
      if (code === 'NOT_FOUND') {
        res.status(404).json({ error: { code, message: (err as Error).message } });
        return;
      }
      throw err;
    }
  }),
);

export { router as campaignRouter };
