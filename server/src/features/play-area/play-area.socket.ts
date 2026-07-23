import type {
    ChatReceivedPayload,
    FogHiddenPayload,
    FogRevealedPayload,
    PresencePayload,
    TokenMovedPayload,
} from '@vtt/shared';
import {
    CHAT_EVENTS,
    DICE_EVENTS,
    FOG_EVENTS,
    PLAY_AREA_EVENTS,
    VISION_SYNC_DEBOUNCE_MS,
    chatSendPayloadSchema,
    diceRollPayloadSchema,
    fogHidePayloadSchema,
    fogRevealPayloadSchema,
    roomJoinPayloadSchema,
    tokenMoveSocketPayloadSchema,
} from '@vtt/shared';
import type { Server, Socket } from 'socket.io';

import { prisma } from '../../shared/db/prisma.js';
import { parseDiceFormula, rollDiceFormula } from './dice.service.js';
import { hideFogByPolygon, revealFogRegion } from './fog.service.js';
import { emitVisionSync, emitVisionSyncToSocket } from './vision.service.js';

/** Per-campaign debounce timers for vision sync broadcasts. */
const visionSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Debounce vision sync: wait VISION_SYNC_DEBOUNCE_MS after the last token move
 * before broadcasting — prevents flooding when many tokens move rapidly.
 * Keyed by `campaign:sceneId` to avoid stale sceneId when multiple scenes are active.
 */
function scheduleVisionSync(io: Server, campaignId: string, sceneId: string): void {
  const key = `${campaignId}:${sceneId}`;
  const existing = visionSyncTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    visionSyncTimers.delete(key);
    emitVisionSync(io, campaignId, sceneId).catch((err: unknown) => {
      console.error('[play-area socket] vision:sync error', err);
    });
  }, VISION_SYNC_DEBOUNCE_MS);

  visionSyncTimers.set(key, timer);
}

/**
 * Registers all play-area Socket.IO event handlers for a connected socket.
 *
 * Flow:
 *  1. Client emits `play-area:room:join` with campaignId
 *  2. Server validates campaign membership, joins room, broadcasts presence
 *  3. Client emits `play-area:token:move` with position delta (debounced 100ms)
 *  4. Server validates payload, campaign match, and token ownership, then broadcasts
 *  5. On disconnect, server broadcasts `play-area:user:left`
 */
export function registerPlayAreaHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;
  const username = socket.data.username as string;

  socket.on(PLAY_AREA_EVENTS.ROOM_JOIN, async (rawPayload: unknown) => {
    try {
      const parsed = roomJoinPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid room join payload',
        });
        return;
      }

      const { campaignId } = parsed.data;

      // Validate campaign membership
      const membership = await prisma.campaignPlayer.findUnique({
        where: { campaignId_userId: { campaignId, userId } },
        select: { role: true },
      });

      if (!membership) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'You are not a member of this campaign',
        });
        return;
      }

      // Leave any previous campaign room before joining a new one
      const previousCampaignId = socket.data.campaignId as string | undefined;
      if (previousCampaignId && previousCampaignId !== campaignId) {
        await socket.leave(`campaign:${previousCampaignId}`);
      }

      const room = `campaign:${campaignId}`;
      socket.data.campaignId = campaignId;
      socket.data.campaignRole = membership.role;
      await socket.join(room);

      // Broadcast presence to all in the room including the joining user
      const presencePayload: PresencePayload = { userId, username, campaignId };
      io.to(room).emit(PLAY_AREA_EVENTS.USER_JOINED, presencePayload);

      // Emit initial vision sync to the joining socket only (not the whole room)
      const activeScene = await prisma.scene.findFirst({
        where: { campaignId, isActive: true },
        select: { id: true },
      });
      if (activeScene) {
        emitVisionSyncToSocket(socket, campaignId, activeScene.id).catch((err: unknown) => {
          console.error('[play-area socket] room:join vision:sync error', err);
        });
      }
    } catch (err) {
      console.error('[play-area socket] room:join error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to join campaign room',
      });
    }
  });

  socket.on(PLAY_AREA_EVENTS.TOKEN_MOVE, async (rawPayload: unknown) => {
    try {
      const parsed = tokenMoveSocketPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid token move payload',
        });
        return;
      }

      const { tokenId, x, y, campaignId } = parsed.data;

      // Guard: campaign in payload must match the room the socket joined
      if (campaignId !== socket.data.campaignId) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'Campaign ID mismatch',
        });
        return;
      }

      // Ownership check: DMs may move any token; players must own it
      const role = socket.data.campaignRole as string | undefined;
      let tokenSceneId: string | undefined;
      if (role !== 'dm') {
        const token = await prisma.token.findUnique({
          where: { id: tokenId },
          select: { ownerId: true, sceneId: true },
        });
        if (!token) {
          socket.emit(PLAY_AREA_EVENTS.ERROR, {
            code: 'NOT_FOUND',
            message: 'Token not found',
          });
          return;
        }
        if (token.ownerId !== userId) {
          socket.emit(PLAY_AREA_EVENTS.ERROR, {
            code: 'FORBIDDEN',
            message: 'You do not own this token',
          });
          return;
        }
        tokenSceneId = token.sceneId;
      } else {
        const token = await prisma.token.findUnique({
          where: { id: tokenId },
          select: { sceneId: true },
        });
        tokenSceneId = token?.sceneId;
      }

      const room = `campaign:${campaignId}`;

      // Broadcast to others only — sender already applied optimistic update
      const movedPayload: TokenMovedPayload = { tokenId, x, y, campaignId, userId };
      socket.to(room).emit(PLAY_AREA_EVENTS.TOKEN_MOVED, movedPayload);

      // Schedule a debounced vision sync for the campaign (tokenSceneId guaranteed by DB)
      if (tokenSceneId) {
        scheduleVisionSync(io, campaignId, tokenSceneId);
      }
    } catch (err) {
      console.error('[play-area socket] token:move error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to broadcast token move',
      });
    }
  });

  socket.on(CHAT_EVENTS.CHAT_SEND, async (rawPayload: unknown) => {
    try {
      const parsed = chatSendPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid chat payload',
        });
        return;
      }

      const { campaignId, text } = parsed.data;

      // Guard: must have joined a campaign room
      if (campaignId !== socket.data.campaignId) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'You have not joined this campaign room',
        });
        return;
      }

      const row = await prisma.campaignMessage.create({
        data: {
          campaignId,
          userId,
          username,
          text,
          type: 'chat',
        },
      });

      const chatPayload: ChatReceivedPayload = {
        message: {
          id: row.id,
          campaignId: row.campaignId,
          userId: row.userId,
          username: row.username,
          text: row.text,
          type: row.type as 'chat' | 'roll' | 'system',
          rollData: null,
          createdAt: row.createdAt.toISOString(),
        },
      };

      // Echo back to sender + broadcast to room — same code path for all recipients
      const room = `campaign:${campaignId}`;
      io.to(room).emit(CHAT_EVENTS.CHAT_RECEIVED, chatPayload);
    } catch (err) {
      console.error('[play-area socket] chat:send error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to send message',
      });
    }
  });

  socket.on(DICE_EVENTS.DICE_ROLL, async (rawPayload: unknown) => {
    try {
      const parsed = diceRollPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid dice roll payload',
        });
        return;
      }

      const { campaignId, formula } = parsed.data;

      // Guard: must have joined this campaign room
      if (campaignId !== socket.data.campaignId) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'You have not joined this campaign room',
        });
        return;
      }

      // Guard: observers are read-only — dice rolls persist messages
      const role = socket.data.campaignRole as string | undefined;
      if (role === 'observer') {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'Observers cannot roll dice',
        });
        return;
      }

      const parsedFormula = parseDiceFormula(formula);
      if (!parsedFormula) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_FORMULA',
          message: `Cannot parse dice formula: "${formula}"`,
        });
        return;
      }

      const rollResult = rollDiceFormula(parsedFormula);

      const row = await prisma.campaignMessage.create({
        data: {
          campaignId,
          userId,
          username,
          text: formula,
          type: 'roll',
          // Prisma requires InputJsonValue — spread into a plain object to satisfy the index signature
          rollData: { ...rollResult },
        },
      });

      const chatPayload: ChatReceivedPayload = {
        message: {
          id: row.id,
          campaignId: row.campaignId,
          userId: row.userId,
          username: row.username,
          text: row.text,
          type: 'roll',
          rollData: rollResult,
          createdAt: row.createdAt.toISOString(),
        },
      };

      const room = `campaign:${campaignId}`;
      io.to(room).emit(CHAT_EVENTS.CHAT_RECEIVED, chatPayload);
    } catch (err) {
      console.error('[play-area socket] dice:roll error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process dice roll',
      });
    }
  });

  socket.on(FOG_EVENTS.FOG_REVEAL, async (rawPayload: unknown) => {
    try {
      const parsed = fogRevealPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid fog reveal payload',
        });
        return;
      }

      const { campaignId, sceneId, vertices } = parsed.data;

      if (campaignId !== socket.data.campaignId) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'You have not joined this campaign room',
        });
        return;
      }

      const role = socket.data.campaignRole as string | undefined;
      if (role !== 'dm') {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'Only the DM can reveal fog',
        });
        return;
      }

      const region = await revealFogRegion(sceneId, campaignId, userId, vertices);

      const room = `campaign:${campaignId}`;
      io.to(room).emit(FOG_EVENTS.FOG_REVEALED, {
        region,
        campaignId,
        sceneId,
      } satisfies FogRevealedPayload);
    } catch (err) {
      console.error('[play-area socket] fog:reveal error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reveal fog region',
      });
    }
  });

  socket.on(FOG_EVENTS.FOG_HIDE, async (rawPayload: unknown) => {
    try {
      const parsed = fogHidePayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid fog hide payload',
        });
        return;
      }

      const { campaignId, sceneId, vertices } = parsed.data;

      if (campaignId !== socket.data.campaignId) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'You have not joined this campaign room',
        });
        return;
      }

      const role = socket.data.campaignRole as string | undefined;
      if (role !== 'dm') {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'Only the DM can hide fog',
        });
        return;
      }

      const removedRegionIds = await hideFogByPolygon(sceneId, campaignId, vertices);

      const room = `campaign:${campaignId}`;
      io.to(room).emit(FOG_EVENTS.FOG_HIDDEN, {
        removedRegionIds,
        campaignId,
        sceneId,
      } satisfies FogHiddenPayload);
    } catch (err) {
      console.error('[play-area socket] fog:hide error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to hide fog region',
      });
    }
  });

  socket.on('disconnect', () => {
    const campaignId = socket.data.campaignId as string | undefined;
    if (!campaignId) return;

    const room = `campaign:${campaignId}`;
    const presencePayload: PresencePayload = { userId, username, campaignId };
    socket.to(room).emit(PLAY_AREA_EVENTS.USER_LEFT, presencePayload);
  });
}

