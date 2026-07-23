import type { ChatMessage, MessageType } from '@vtt/shared';
import { CHAT_HISTORY_LIMIT, CHAT_HISTORY_MAX_LIMIT } from '@vtt/shared';
import { Router } from 'express';

import { prisma } from '../../shared/db/prisma.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireCampaignRole } from '../campaigns/campaigns.middleware.js';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/campaigns/:id/messages
 *
 * Returns persisted chat history in ascending chronological order.
 * Query param `limit` is respected up to a server-enforced cap of 100.
 */
router.get(
  '/:id/messages',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const campaignId = req.params.id;

    const rawLimit = Number(req.query.limit ?? CHAT_HISTORY_LIMIT);
    const limit = Number.isNaN(rawLimit)
      ? CHAT_HISTORY_LIMIT
      : Math.min(Math.max(rawLimit, 1), CHAT_HISTORY_MAX_LIMIT);

    const rows = await prisma.campaignMessage.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const messages = rows.map((row): ChatMessage => ({
      id: row.id,
      campaignId: row.campaignId,
      userId: row.userId,
      username: row.username,
      text: row.text,
      type: row.type as MessageType,
      rollData: row.rollData ?? null,
      createdAt: row.createdAt.toISOString(),
    }));

    res.status(200).json({ data: messages });
  }),
);

export { router as messagesRouter };

