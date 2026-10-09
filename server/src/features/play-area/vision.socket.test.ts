import type { AddressInfo } from 'node:net';

import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { DoorToggledPayload, SocketErrorPayload, VisionUpdatedPayload } from '@vtt/shared';
import { PLAY_AREA_EVENTS, TOKEN_VISION_EVENTS, VISION_EVENTS } from '@vtt/shared';

import { app, httpServer } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { loginAsHeader as loginAs } from '../../shared/test-utils/login.js';
import { hashPassword } from '../../shared/utils/password.js';

const PASSWORD = 'password123';
const EMAILS = {
  dm: 'los-dm@test.com',
  player: 'los-player@test.com',
  observer: 'los-observer@test.com',
} as const;

let SERVER_URL: string;

async function purgeTestUsers(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { in: Object.values(EMAILS) } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.campaign.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

beforeAll(async () => {
  await purgeTestUsers();
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(0, () => {
      SERVER_URL = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
      resolve();
    });
    httpServer.once('error', reject);
  });
});

afterAll(
  () =>
    new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    }),
);

async function createUser(username: string, email: string): Promise<string> {
  const user = await prisma.user.create({
    data: { username, email, passwordHash: await hashPassword(PASSWORD) },
  });
  return user.id;
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Line-of-sight socket handlers (Phase PM3)', () => {
  let campaignId: string;
  let sceneId: string;
  let visibleDoorId: string;
  let hiddenDoorId: string;
  let plainWallId: string;
  const cookies: Record<keyof typeof EMAILS, string> = { dm: '', player: '', observer: '' };
  const openSockets: ClientSocket[] = [];

  beforeEach(async () => {
    await createUser('LosDM', EMAILS.dm);
    const playerId = await createUser('LosPlayer', EMAILS.player);
    await createUser('LosObserver', EMAILS.observer);
    for (const role of Object.keys(EMAILS) as (keyof typeof EMAILS)[]) {
      cookies[role] = await loginAs(EMAILS[role]);
    }

    const created = await request(app)
      .post('/api/campaigns')
      .set('Cookie', cookies.dm)
      .send({ name: 'LOS Campaign' });
    campaignId = (created.body as { data: { id: string } }).data.id;
    for (const role of ['player', 'observer'] as const) {
      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', cookies.dm)
        .send({ email: EMAILS[role], role });
    }

    // The invite flow auto-creates an active default scene — deactivate it so the
    // test scene can be the single active scene per campaign (5H partial unique index)
    await prisma.scene.updateMany({ where: { campaignId }, data: { isActive: false } });
    sceneId = (
      await prisma.scene.create({ data: { campaignId, name: 'LOS Scene', isActive: true } })
    ).id;
    // Player at (160,160) with a 384px radius
    await prisma.token.create({
      data: { sceneId, campaignId, name: 'Hero', type: 'player', x: 2, y: 2, ownerId: playerId },
    });

    const wall = (x1: number, y1: number, x2: number, y2: number, isDoor = false): Promise<{ id: string }> =>
      prisma.wallSegment.create({
        data: { campaignId, sceneId, x1, y1, x2, y2, isDoor },
        select: { id: true },
      });
    plainWallId = (await wall(256, 0, 256, 384)).id;
    visibleDoorId = (await wall(256, 384, 256, 448, true)).id;
    hiddenDoorId = (await wall(600, 100, 600, 164, true)).id;
  });

  afterEach(async () => {
    for (const s of openSockets) s.disconnect();
    openSockets.length = 0;
    await purgeTestUsers();
  });

  /** Connect, join the campaign room, and drain the join-time vision sync (active scene only). */
  async function joinAs(role: keyof typeof EMAILS, expectSync = true): Promise<ClientSocket> {
    const socket = clientIo(SERVER_URL, {
      extraHeaders: { cookie: cookies[role] },
      autoConnect: false,
      reconnection: false,
    });
    openSockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    const synced = expectSync
      ? waitForEvent(socket, TOKEN_VISION_EVENTS.TOKEN_VISION_SYNC)
      : waitForEvent(socket, PLAY_AREA_EVENTS.USER_JOINED);
    socket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
    await synced;
    return socket;
  }

  async function isOpen(wallId: string): Promise<boolean | undefined> {
    return (await prisma.wallSegment.findUnique({ where: { id: wallId } }))?.isOpen;
  }

  it('lets the DM toggle any door and re-broadcasts vision', async () => {
    const dm = await joinAs('dm');
    const toggled = waitForEvent<DoorToggledPayload>(dm, VISION_EVENTS.DOOR_TOGGLED);
    const updated = waitForEvent<VisionUpdatedPayload>(dm, VISION_EVENTS.VISION_UPDATED);

    dm.emit(VISION_EVENTS.DOOR_TOGGLE, { campaignId, sceneId, wallId: hiddenDoorId });

    await expect(toggled).resolves.toMatchObject({ wallId: hiddenDoorId, isOpen: true });
    const vision = await updated;
    expect(vision.doors.find((d) => d.id === hiddenDoorId)?.isOpen).toBe(true);
    expect(await isOpen(hiddenDoorId)).toBe(true);
  });

  it('lets a player toggle a door the party can see and notifies the DM', async () => {
    const dm = await joinAs('dm');
    const player = await joinAs('player');
    const dmToggled = waitForEvent<DoorToggledPayload>(dm, VISION_EVENTS.DOOR_TOGGLED);
    const playerToggled = waitForEvent<DoorToggledPayload>(player, VISION_EVENTS.DOOR_TOGGLED);

    player.emit(VISION_EVENTS.DOOR_TOGGLE, { campaignId, sceneId, wallId: visibleDoorId });

    await expect(playerToggled).resolves.toMatchObject({ wallId: visibleDoorId, isOpen: true });
    await expect(dmToggled).resolves.toMatchObject({ wallId: visibleDoorId, isOpen: true });
    expect(await isOpen(visibleDoorId)).toBe(true);
  });

  it('answers NOT_FOUND when a player targets a door the party cannot see', async () => {
    const player = await joinAs('player');
    const error = waitForEvent<SocketErrorPayload>(player, PLAY_AREA_EVENTS.ERROR);

    player.emit(VISION_EVENTS.DOOR_TOGGLE, { campaignId, sceneId, wallId: hiddenDoorId });

    await expect(error).resolves.toMatchObject({ code: 'NOT_FOUND' });
    expect(await isOpen(hiddenDoorId)).toBe(false);
  });

  it('rejects observers', async () => {
    const observer = await joinAs('observer');
    const error = waitForEvent<SocketErrorPayload>(observer, PLAY_AREA_EVENTS.ERROR);

    observer.emit(VISION_EVENTS.DOOR_TOGGLE, { campaignId, sceneId, wallId: visibleDoorId });

    await expect(error).resolves.toMatchObject({ code: 'FORBIDDEN' });
    expect(await isOpen(visibleDoorId)).toBe(false);
  });

  it('refuses to toggle a wall that is not a door', async () => {
    const dm = await joinAs('dm');
    const error = waitForEvent<SocketErrorPayload>(dm, PLAY_AREA_EVENTS.ERROR);

    dm.emit(VISION_EVENTS.DOOR_TOGGLE, { campaignId, sceneId, wallId: plainWallId });

    await expect(error).resolves.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rate-limits rapid toggles from one socket', async () => {
    const dm = await joinAs('dm');
    const error = waitForEvent<SocketErrorPayload>(dm, PLAY_AREA_EVENTS.ERROR);

    dm.emit(VISION_EVENTS.DOOR_TOGGLE, { campaignId, sceneId, wallId: visibleDoorId });
    dm.emit(VISION_EVENTS.DOOR_TOGGLE, { campaignId, sceneId, wallId: visibleDoorId });

    await expect(error).resolves.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('validates the payload and the joined campaign', async () => {
    const dm = await joinAs('dm');

    const invalid = waitForEvent<SocketErrorPayload>(dm, PLAY_AREA_EVENTS.ERROR);
    dm.emit(VISION_EVENTS.DOOR_TOGGLE, { campaignId, sceneId, wallId: '' });
    await expect(invalid).resolves.toMatchObject({ code: 'INVALID_PAYLOAD' });

    const mismatch = waitForEvent<SocketErrorPayload>(dm, PLAY_AREA_EVENTS.ERROR);
    dm.emit(VISION_EVENTS.DOOR_TOGGLE, {
      campaignId: '00000000-0000-4000-8000-000000000000',
      sceneId,
      wallId: visibleDoorId,
    });
    await expect(mismatch).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('recomputes vision for the room on a DM vision:refresh', async () => {
    const dm = await joinAs('dm');
    const player = await joinAs('player');
    const updated = waitForEvent<VisionUpdatedPayload>(player, VISION_EVENTS.VISION_UPDATED);

    dm.emit(VISION_EVENTS.VISION_REFRESH, { campaignId, sceneId });

    const vision = await updated;
    expect(vision.sceneId).toBe(sceneId);
    expect(vision.polygons).toHaveLength(1);
    expect(vision.doors.map((d) => d.id)).toEqual([visibleDoorId]);
  });

  it('rejects vision:refresh from non-DMs', async () => {
    const player = await joinAs('player');
    const error = waitForEvent<SocketErrorPayload>(player, PLAY_AREA_EVENTS.ERROR);

    player.emit(VISION_EVENTS.VISION_REFRESH, { campaignId, sceneId });

    await expect(error).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('answers NOT_FOUND when a player targets a door on an inactive scene', async () => {
    await prisma.scene.update({ where: { id: sceneId }, data: { isActive: false } });
    const player = await joinAs('player', false);
    const error = waitForEvent<SocketErrorPayload>(player, PLAY_AREA_EVENTS.ERROR);

    player.emit(VISION_EVENTS.DOOR_TOGGLE, { campaignId, sceneId, wallId: visibleDoorId });

    await expect(error).resolves.toMatchObject({ code: 'NOT_FOUND' });
    expect(await isOpen(visibleDoorId)).toBe(false);
  });

  it('does not send door:toggled to other players', async () => {
    const player = await joinAs('player');
    const dm = await joinAs('dm');
    let playerNotified = false;
    player.on(VISION_EVENTS.DOOR_TOGGLED, () => {
      playerNotified = true;
    });
    const playerVision = waitForEvent<VisionUpdatedPayload>(player, VISION_EVENTS.VISION_UPDATED);

    dm.emit(VISION_EVENTS.DOOR_TOGGLE, { campaignId, sceneId, wallId: visibleDoorId });

    const vision = await playerVision;
    expect(vision.doors.find((d) => d.id === visibleDoorId)?.isOpen).toBe(true);
    expect(playerNotified).toBe(false);
  });

  it('rejects vision:refresh for a scene outside the campaign', async () => {
    const dm = await joinAs('dm');
    const error = waitForEvent<SocketErrorPayload>(dm, PLAY_AREA_EVENTS.ERROR);

    dm.emit(VISION_EVENTS.VISION_REFRESH, {
      campaignId,
      sceneId: '00000000-0000-4000-8000-000000000000',
    });

    await expect(error).resolves.toMatchObject({ code: 'NOT_FOUND' });
  });
});
