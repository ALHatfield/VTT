// Temporary light socket handlers — Phase PM4
// DM-only create/update/delete; every change broadcasts the scene's full temporary-light snapshot.
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';

import type { TemporaryLightsUpdatedPayload } from '@vtt/shared';
import {
    LIGHT_EVENTS,
    PLAY_AREA_EVENTS,
    temporaryLightCreatePayloadSchema,
    temporaryLightDeletePayloadSchema,
    temporaryLightUpdatePayloadSchema,
} from '@vtt/shared';

import { sceneBelongsToCampaign } from './lighting.service.js';
import {
    TemporaryLightLimitError,
    createTemporaryLight,
    deleteTemporaryLight,
    listTemporaryLights,
    updateTemporaryLight,
} from './temporary-lights.store.js';
import { flushVisionSync } from './vision.scheduler.js';

interface LightTarget {
  campaignId: string;
  sceneId: string;
}

function emitError(socket: Socket, code: string, message: string): void {
  socket.emit(PLAY_AREA_EVENTS.ERROR, { code, message });
}

function broadcastTemporaryLights(io: Server, { campaignId, sceneId }: LightTarget): void {
  io.to(`campaign:${campaignId}`).emit(LIGHT_EVENTS.LIGHT_UPDATED, {
    campaignId,
    sceneId,
    lights: listTemporaryLights(campaignId, sceneId),
  } satisfies TemporaryLightsUpdatedPayload);
  // Lights reveal their radius to players (PM3), so the lit area must be recomputed
  flushVisionSync(io, campaignId, sceneId);
}

/**
 * Validates payload shape, room membership, DM role, and scene ownership.
 * Emits the matching error and returns null on any failure.
 */
async function authorizeDmLightAction<T extends LightTarget>(
  socket: Socket,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  rawPayload: unknown,
): Promise<T | null> {
  const parsed = schema.safeParse(rawPayload);
  if (!parsed.success) {
    emitError(socket, 'INVALID_PAYLOAD', 'Invalid light payload');
    return null;
  }
  if (parsed.data.campaignId !== socket.data.campaignId) {
    emitError(socket, 'FORBIDDEN', 'You have not joined this campaign room');
    return null;
  }
  if (socket.data.campaignRole !== 'dm') {
    emitError(socket, 'FORBIDDEN', 'Only the DM can manage temporary lights');
    return null;
  }
  if (!(await sceneBelongsToCampaign(parsed.data.campaignId, parsed.data.sceneId))) {
    emitError(socket, 'NOT_FOUND', 'Scene not found');
    return null;
  }
  return parsed.data;
}

export function registerLightHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;

  socket.on(LIGHT_EVENTS.LIGHT_CREATE, async (rawPayload: unknown) => {
    try {
      const payload = await authorizeDmLightAction(
        socket,
        temporaryLightCreatePayloadSchema,
        rawPayload,
      );
      if (!payload) return;
      createTemporaryLight(payload, userId);
      broadcastTemporaryLights(io, payload);
    } catch (err) {
      if (err instanceof TemporaryLightLimitError) {
        emitError(socket, 'LIGHT_LIMIT_REACHED', err.message);
        return;
      }
      console.error('[play-area socket] light:create error', err);
      emitError(socket, 'INTERNAL_ERROR', 'Failed to create light');
    }
  });

  socket.on(LIGHT_EVENTS.LIGHT_UPDATE, async (rawPayload: unknown) => {
    try {
      const payload = await authorizeDmLightAction(
        socket,
        temporaryLightUpdatePayloadSchema,
        rawPayload,
      );
      if (!payload) return;
      const updated = updateTemporaryLight(
        payload.campaignId,
        payload.sceneId,
        payload.lightId,
        payload.changes,
      );
      if (!updated) {
        emitError(socket, 'NOT_FOUND', 'Light not found');
        return;
      }
      broadcastTemporaryLights(io, payload);
    } catch (err) {
      console.error('[play-area socket] light:update error', err);
      emitError(socket, 'INTERNAL_ERROR', 'Failed to update light');
    }
  });

  socket.on(LIGHT_EVENTS.LIGHT_DELETE, async (rawPayload: unknown) => {
    try {
      const payload = await authorizeDmLightAction(
        socket,
        temporaryLightDeletePayloadSchema,
        rawPayload,
      );
      if (!payload) return;
      if (!deleteTemporaryLight(payload.campaignId, payload.sceneId, payload.lightId)) {
        emitError(socket, 'NOT_FOUND', 'Light not found');
        return;
      }
      broadcastTemporaryLights(io, payload);
    } catch (err) {
      console.error('[play-area socket] light:delete error', err);
      emitError(socket, 'INTERNAL_ERROR', 'Failed to delete light');
    }
  });
}
