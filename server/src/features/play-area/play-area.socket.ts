import type {
  AuraUpdatedPayload,
  ChatReceivedPayload,
  DrawClearedPayload,
  DrawStrokeRelayedPayload,
  FogHiddenPayload,
  FogRegionDeletedPayload,
  FogRevealedPayload,
  InitiativeUpdatedPayload,
  MeasureBroadcastPayload,
  MeasureClearPayload,
  PresencePayload,
  TokenMovedPayload,
  TokenUpdatedPayload,
} from '@vtt/shared';
import {
  AURA_EVENTS,
  CHAT_EVENTS,
  DICE_EVENTS,
  DRAW_EVENTS,
  FOG_EVENTS,
  INITIATIVE_EVENTS,
  MEASURE_EVENTS,
  PLAY_AREA_EVENTS,
  VISION_SYNC_DEBOUNCE_MS,
  auraUpdatePayloadSchema,
  chatSendPayloadSchema,
  diceRollPayloadSchema,
  drawClearPayloadSchema,
  drawStrokePayloadSchema,
  fogHidePayloadSchema,
  fogRegionDeletePayloadSchema,
  fogRevealPayloadSchema,
  initiativeAdvancePayloadSchema,
  initiativeEndPayloadSchema,
  initiativeReorderPayloadSchema,
  initiativeStartPayloadSchema,
  measureBroadcastPayloadSchema,
  measureClearPayloadSchema,
  roomJoinPayloadSchema,
  tokenMoveSocketPayloadSchema,
} from '@vtt/shared';
import type { Server, Socket } from 'socket.io';

import { prisma } from '../../shared/db/prisma.js';
import { parseDiceFormula, rollDiceFormula } from './dice.service.js';
import { deleteFogRegion, hideFogByPolygon, revealFogRegion } from './fog.service.js';
import {
  advanceInitiativeForCampaign,
  endInitiativeForCampaign,
  getInitiativeState,
  reorderInitiativeForCampaign,
  startInitiativeForCampaign,
} from './initiative.service.js';
import { updateToken } from './tokens.service.js';
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
        select: { role: true, color: true },
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
      socket.data.playerColor = membership.color ?? '#4a9eff';
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

      const initiativeState = getInitiativeState(campaignId);
      if (initiativeState) {
        socket.emit(INITIATIVE_EVENTS.INITIATIVE_UPDATED, {
          state: initiativeState,
        } satisfies InitiativeUpdatedPayload);
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

  socket.on(AURA_EVENTS.AURA_UPDATE, async (rawPayload: unknown) => {
    try {
      const parsed = auraUpdatePayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid aura update payload',
        });
        return;
      }

      const { tokenId, campaignId, aura } = parsed.data;
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
          message: 'Only the DM can update token auras',
        });
        return;
      }

      const existingToken = await prisma.token.findFirst({
        where: { id: tokenId, campaignId },
        select: { sceneId: true },
      });
      if (!existingToken) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'NOT_FOUND',
          message: 'Token not found',
        });
        return;
      }

      const token = await updateToken(
        tokenId,
        existingToken.sceneId,
        campaignId,
        {
          ...(aura.radius !== undefined && { auraRadius: aura.radius }),
          ...(aura.color !== undefined && { auraColor: aura.color }),
          ...(aura.visible !== undefined && { auraVisible: aura.visible }),
          ...(aura.type !== undefined && { auraType: aura.type }),
          ...(aura.condition !== undefined && { auraCondition: aura.condition }),
        },
        userId,
        role,
      );

      const room = `campaign:${campaignId}`;
      io.to(room).emit(AURA_EVENTS.AURA_UPDATED, {
        token,
        campaignId,
      } satisfies AuraUpdatedPayload);
      io.to(room).emit(PLAY_AREA_EVENTS.TOKEN_UPDATED, {
        token,
        campaignId,
      } satisfies TokenUpdatedPayload);
    } catch (err) {
      console.error('[play-area socket] aura:update error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update token aura',
      });
    }
  });

  socket.on(INITIATIVE_EVENTS.INITIATIVE_START, async (rawPayload: unknown) => {
    try {
      const parsed = initiativeStartPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid initiative start payload',
        });
        return;
      }

      const { campaignId, tokenIds } = parsed.data;

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
          message: 'Only the DM can start initiative',
        });
        return;
      }

      const state = await startInitiativeForCampaign(campaignId, tokenIds);
      const room = `campaign:${campaignId}`;
      io.to(room).emit(INITIATIVE_EVENTS.INITIATIVE_UPDATED, {
        state,
      } satisfies InitiativeUpdatedPayload);
    } catch (err) {
      console.error('[play-area socket] initiative:start error', err);
      if (err instanceof Error && err.message.startsWith('Initiative start token list')) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: err.message,
        });
        return;
      }
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to start initiative',
      });
    }
  });

  socket.on(INITIATIVE_EVENTS.INITIATIVE_ADVANCE, (rawPayload: unknown) => {
    try {
      const parsed = initiativeAdvancePayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid initiative advance payload',
        });
        return;
      }

      const { campaignId } = parsed.data;

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
          message: 'Only the DM can advance initiative',
        });
        return;
      }

      const state = advanceInitiativeForCampaign(campaignId);
      const room = `campaign:${campaignId}`;
      io.to(room).emit(INITIATIVE_EVENTS.INITIATIVE_UPDATED, {
        state,
      } satisfies InitiativeUpdatedPayload);
    } catch (err) {
      console.error('[play-area socket] initiative:advance error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to advance initiative',
      });
    }
  });

  socket.on(INITIATIVE_EVENTS.INITIATIVE_END, (rawPayload: unknown) => {
    try {
      const parsed = initiativeEndPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid initiative end payload',
        });
        return;
      }

      const { campaignId } = parsed.data;

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
          message: 'Only the DM can end initiative',
        });
        return;
      }

      const state = endInitiativeForCampaign(campaignId);
      const room = `campaign:${campaignId}`;
      io.to(room).emit(INITIATIVE_EVENTS.INITIATIVE_UPDATED, {
        state,
      } satisfies InitiativeUpdatedPayload);
    } catch (err) {
      console.error('[play-area socket] initiative:end error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to end initiative',
      });
    }
  });

  socket.on(INITIATIVE_EVENTS.INITIATIVE_REORDER, (rawPayload: unknown) => {
    try {
      const parsed = initiativeReorderPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid initiative reorder payload',
        });
        return;
      }

      const { campaignId, tokenIds } = parsed.data;

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
          message: 'Only the DM can reorder initiative',
        });
        return;
      }

      const state = reorderInitiativeForCampaign(campaignId, tokenIds);
      const room = `campaign:${campaignId}`;
      io.to(room).emit(INITIATIVE_EVENTS.INITIATIVE_UPDATED, {
        state,
      } satisfies InitiativeUpdatedPayload);
    } catch (err) {
      console.error('[play-area socket] initiative:reorder error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INVALID_PAYLOAD',
        message: 'Failed to reorder initiative',
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

  socket.on(FOG_EVENTS.FOG_REGION_DELETE, async (rawPayload: unknown) => {
    try {
      const parsed = fogRegionDeletePayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid fog region delete payload',
        });
        return;
      }

      const { campaignId, sceneId, regionId } = parsed.data;

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
          message: 'Only the DM can delete fog regions',
        });
        return;
      }

      await deleteFogRegion(regionId, sceneId, campaignId);

      const room = `campaign:${campaignId}`;
      io.to(room).emit(FOG_EVENTS.FOG_REGION_DELETED, {
        regionId,
        campaignId,
        sceneId,
      } satisfies FogRegionDeletedPayload);
    } catch (err) {
      console.error('[play-area socket] fog:region:delete error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete fog region',
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

  // ---------------------------------------------------------------------------
  // Measure tool handlers (Phase 4J)
  // ---------------------------------------------------------------------------

  socket.on(MEASURE_EVENTS.MEASURE_BROADCAST, (rawPayload: unknown) => {
    try {
      const parsed = measureBroadcastPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid measure broadcast payload',
        });
        return;
      }

      const { campaignId, isPrivate, color: _clientColor, ...rest } = parsed.data;

      if (campaignId !== socket.data.campaignId) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'Campaign ID mismatch',
        });
        return;
      }

      const room = `campaign:${campaignId}`;
      // Use authoritative color from socket.data — ignore client-supplied color to prevent impersonation
      const authorativeColor = (socket.data.playerColor as string | undefined) ?? '#4a9eff';
      const relayPayload: MeasureBroadcastPayload & { userId: string } = {
        campaignId,
        isPrivate,
        userId,
        color: authorativeColor,
        ...rest,
      };

      if (isPrivate) {
        // Private: relay only to DM sockets in the room (excludes sender)
        const sockets = io.sockets.adapter.rooms.get(room);
        if (sockets) {
          for (const socketId of sockets) {
            const target = io.sockets.sockets.get(socketId);
            if (!target || target.id === socket.id) continue;
            if (target.data.campaignRole === 'dm') {
              target.emit(MEASURE_EVENTS.MEASURE_RELAYED, relayPayload);
            }
          }
        }
      } else {
        // Public: broadcast to everyone else in the room
        socket.to(room).emit(MEASURE_EVENTS.MEASURE_RELAYED, relayPayload);
      }
    } catch (err) {
      console.error('[play-area socket] measure:broadcast error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to relay measure broadcast',
      });
    }
  });

  socket.on(MEASURE_EVENTS.MEASURE_CLEAR, (rawPayload: unknown) => {
    try {
      const parsed = measureClearPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid measure clear payload',
        });
        return;
      }

      const { campaignId, isPrivate } = parsed.data;

      if (campaignId !== socket.data.campaignId) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'Campaign ID mismatch',
        });
        return;
      }

      const clearPayload: MeasureClearPayload & { userId: string } = {
        campaignId,
        isPrivate,
        userId,
      };
      const room = `campaign:${campaignId}`;

      if (isPrivate) {
        // Private: relay clear only to DM sockets (same audience as the broadcast)
        const sockets = io.sockets.adapter.rooms.get(room);
        if (sockets) {
          for (const socketId of sockets) {
            const target = io.sockets.sockets.get(socketId);
            if (!target || target.id === socket.id) continue;
            if (target.data.campaignRole === 'dm') {
              target.emit(MEASURE_EVENTS.MEASURE_CLEARED, clearPayload);
            }
          }
        }
      } else {
        socket.to(room).emit(MEASURE_EVENTS.MEASURE_CLEARED, clearPayload);
      }
    } catch (err) {
      console.error('[play-area socket] measure:clear error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to relay measure clear',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Drawing tool handlers (Phase 4K)
  // ---------------------------------------------------------------------------

  socket.on(DRAW_EVENTS.DRAW_STROKE, (rawPayload: unknown) => {
    try {
      const parsed = drawStrokePayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid draw stroke payload',
        });
        return;
      }

      const { campaignId } = parsed.data;

      if (campaignId !== socket.data.campaignId) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'Campaign ID mismatch',
        });
        return;
      }

      const role = socket.data.campaignRole as string | undefined;
      if (role === 'observer') {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'Observers cannot draw',
        });
        return;
      }

      const relayPayload: DrawStrokeRelayedPayload = {
        ...parsed.data,
        userId,
      };

      const room = `campaign:${campaignId}`;
      socket.to(room).emit(DRAW_EVENTS.DRAW_STROKED, relayPayload);
    } catch (err) {
      console.error('[play-area socket] draw:stroke error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to relay draw stroke',
      });
    }
  });

  socket.on(DRAW_EVENTS.DRAW_CLEAR, (rawPayload: unknown) => {
    try {
      const parsed = drawClearPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid draw clear payload',
        });
        return;
      }

      const { campaignId, scope: requestedScope } = parsed.data;

      if (campaignId !== socket.data.campaignId) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'Campaign ID mismatch',
        });
        return;
      }

      const role = socket.data.campaignRole as string | undefined;
      // Only DMs may clear all; non-DMs are forced to 'own'
      const scope: 'all' | 'own' = role === 'dm' ? requestedScope : 'own';

      const clearPayload: DrawClearedPayload = { campaignId, scope, userId };

      const room = `campaign:${campaignId}`;
      // Include sender so their own canvas is also cleared
      io.to(room).emit(DRAW_EVENTS.DRAW_CLEARED, clearPayload);
    } catch (err) {
      console.error('[play-area socket] draw:clear error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to relay draw clear',
      });
    }
  });
}
