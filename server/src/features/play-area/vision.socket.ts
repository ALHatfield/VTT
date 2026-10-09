// Line-of-sight socket handlers — Phase PM3
// `vision:refresh` (DM only, sent after wall edits) coalesces into the throttled scene
// recompute; `door:toggle` flips a door (DM: any door, player: doors the party can see on
// the active scene) and re-broadcasts vision through the same serialized scheduler.
import type { Server, Socket } from 'socket.io';

import type { DoorToggledPayload } from '@vtt/shared';
import {
    DOOR_TOGGLE_COOLDOWN_MS,
    PLAY_AREA_EVENTS,
    VISION_EVENTS,
    doorTogglePayloadSchema,
    visionRefreshPayloadSchema,
} from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';
import { findDoor, toggleDoor } from './doors.service.js';
import { sceneBelongsToCampaign } from './lighting.service.js';
import { flushVisionSync, scheduleVisionSync } from './vision.scheduler.js';
import { isDoorVisibleToParty } from './vision.service.js';

/** Last toggle time per user — shared across that user's tabs/sockets. */
const lastDoorToggleByUser = new Map<string, number>();

function emitError(socket: Socket, code: string, message: string): void {
  socket.emit(PLAY_AREA_EVENTS.ERROR, { code, message });
}

async function isActiveScene(campaignId: string, sceneId: string): Promise<boolean> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, campaignId, isActive: true },
    select: { id: true },
  });
  return scene !== null;
}

/** Door state changes go to DMs (wall caches) and the requester; players learn the rest via vision. */
async function broadcastDoorToggled(
  io: Server,
  socket: Socket,
  payload: DoorToggledPayload,
): Promise<void> {
  const sockets = await io.in(`campaign:${payload.campaignId}`).fetchSockets();
  for (const target of sockets) {
    if (target.data.campaignRole === 'dm' && target.id !== socket.id) {
      target.emit(VISION_EVENTS.DOOR_TOGGLED, payload);
    }
  }
  socket.emit(VISION_EVENTS.DOOR_TOGGLED, payload);
}

export function registerVisionHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;

  socket.on(VISION_EVENTS.VISION_REFRESH, async (rawPayload: unknown) => {
    try {
      const parsed = visionRefreshPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid vision refresh payload');
        return;
      }
      const { campaignId, sceneId } = parsed.data;
      if (campaignId !== socket.data.campaignId) {
        emitError(socket, 'FORBIDDEN', 'You have not joined this campaign room');
        return;
      }
      if (socket.data.campaignRole !== 'dm') {
        emitError(socket, 'FORBIDDEN', 'Only the DM can refresh line of sight');
        return;
      }
      if (!(await sceneBelongsToCampaign(campaignId, sceneId))) {
        emitError(socket, 'NOT_FOUND', 'Scene not found');
        return;
      }
      scheduleVisionSync(io, campaignId, sceneId);
    } catch (err) {
      console.error('[play-area socket] vision:refresh error', err);
      emitError(socket, 'INTERNAL_ERROR', 'Failed to refresh vision');
    }
  });

  socket.on(VISION_EVENTS.DOOR_TOGGLE, async (rawPayload: unknown) => {
    try {
      const parsed = doorTogglePayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid door toggle payload');
        return;
      }
      const { campaignId, sceneId, wallId } = parsed.data;
      if (campaignId !== socket.data.campaignId) {
        emitError(socket, 'FORBIDDEN', 'You have not joined this campaign room');
        return;
      }

      const role = socket.data.campaignRole as string | undefined;
      if (role !== 'dm' && role !== 'player') {
        emitError(socket, 'FORBIDDEN', 'Observers cannot open or close doors');
        return;
      }

      const now = Date.now();
      if (now - (lastDoorToggleByUser.get(userId) ?? 0) < DOOR_TOGGLE_COOLDOWN_MS) {
        emitError(
          socket,
          'RATE_LIMITED',
          `Doors can only be toggled once every ${DOOR_TOGGLE_COOLDOWN_MS}ms`,
        );
        return;
      }
      lastDoorToggleByUser.set(userId, now);

      const door = await findDoor(campaignId, sceneId, wallId);
      const canSee =
        role === 'dm' ||
        (door !== null &&
          (await isActiveScene(campaignId, sceneId)) &&
          (await isDoorVisibleToParty(campaignId, sceneId, wallId)));
      // Players get the same NOT_FOUND for unseen doors so door ids cannot be probed.
      if (!door || !canSee) {
        emitError(socket, 'NOT_FOUND', 'Door not found');
        return;
      }

      const isOpen = await toggleDoor(door);
      if (isOpen === null) {
        emitError(socket, 'CONFLICT', 'Door changed before it could be toggled');
        return;
      }

      await broadcastDoorToggled(io, socket, { campaignId, sceneId, wallId, isOpen });
      flushVisionSync(io, campaignId, sceneId);
    } catch (err) {
      console.error('[play-area socket] door:toggle error', err);
      emitError(socket, 'INTERNAL_ERROR', 'Failed to toggle door');
    }
  });
}
