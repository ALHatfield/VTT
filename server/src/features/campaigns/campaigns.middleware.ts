import type { CampaignRole } from '@vtt/shared';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../shared/db/prisma.js';

/**
 * Middleware to require campaign membership and an optional minimum role.
 *
 * Must be used after `requireAuth`. Expects `req.params.id` to be the campaign ID.
 *
 * Attaches `req.campaignRole` and `req.campaignId` for use in downstream handlers.
 *
 * Role hierarchy: dm > player > observer.
 * DMs pass all role checks. Pass 'member' to allow any member regardless of role.
 *
 * @param role - Required role. 'member' allows any member; 'dm' restricts to DMs only.
 */
export function requireCampaignRole(role: CampaignRole | 'member') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id: campaignId } = req.params;
    const userId = req.session.userId!;

    const membership = await prisma.campaignPlayer.findUnique({
      where: {
        campaignId_userId: { campaignId, userId },
      },
    });

    if (!membership) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You are not a member of this campaign',
        },
      });
      return;
    }

    // DMs have elevated access — they pass all role checks
    const isDm = membership.role === 'dm';

    if (role !== 'member' && !isDm && membership.role !== role) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions for this action',
        },
      });
      return;
    }

    req.campaignRole = membership.role as CampaignRole;
    req.campaignId = campaignId;
    next();
  };
}
