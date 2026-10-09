import type { AddressInfo } from 'node:net';

import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type {
    SceneLighting,
    SocketErrorPayload,
    TemporaryLightsUpdatedPayload,
} from '@vtt/shared';
import { LIGHT_EVENTS, LIGHT_PRESETS, MAX_TEMPORARY_LIGHTS_PER_SCENE, PLAY_AREA_EVENTS } from '@vtt/shared';

import { app, httpServer } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';
import { resetTemporaryLights } from './temporary-lights.store.js';

const TEST_EMAILS = ['lightdm@test.com', 'lightplayer@test.com', 'lightoutsider@test.com'];
const JOIN_SETTLE_MS = 100;
const NO_EVENT_WAIT_MS = 200;
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

let SERVER_URL: string;

async function cleanupUsers(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { in: TEST_EMAILS } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.campaign.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

beforeAll(async () => {
  await cleanupUsers();
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(0, () => {
      const { port } = httpServer.address() as AddressInfo;
      SERVER_URL = `http://localhost:${port}`;
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

async function createUserAndLogin(username: string, email: string): Promise<string> {
  const password = 'password123';
  await prisma.user.create({
    data: { username, email, passwordHash: await hashPassword(password) },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return (res.headers['set-cookie'] as unknown as string[]).join('; ');
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

describe('Play-area lighting (PM4)', () => {
  let dmCookies: string;
  let playerCookies: string;
  let outsiderCookies: string;
  let campaignId: string;
  let sceneId: string;
  const openSockets: ClientSocket[] = [];

  async function joinedSocket(cookies: string): Promise<ClientSocket> {
    const socket = clientIo(SERVER_URL, {
      extraHeaders: { cookie: cookies },
      autoConnect: false,
      reconnection: false,
    });
    openSockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    socket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
    await new Promise<void>((r) => setTimeout(r, JOIN_SETTLE_MS));
    return socket;
  }

  beforeEach(async () => {
    resetTemporaryLights();
    dmCookies = await createUserAndLogin('LightDM', 'lightdm@test.com');
    playerCookies = await createUserAndLogin('LightPlayer', 'lightplayer@test.com');
    outsiderCookies = await createUserAndLogin('LightOutsider', 'lightoutsider@test.com');

    const campaignRes = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Lighting Campaign' });
    campaignId = (campaignRes.body as { data: { id: string } }).data.id;

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'lightplayer@test.com', role: 'player' });

    const sceneRes = await request(app)
      .get(`/api/campaigns/${campaignId}/scenes/active`)
      .set('Cookie', dmCookies);
    sceneId = (sceneRes.body as { data: { id: string } }).data.id;
  });

  afterEach(async () => {
    for (const s of openSockets) s.disconnect();
    openSockets.length = 0;
    resetTemporaryLights();
    await cleanupUsers();
  });

  describe('GET /api/campaigns/:id/scenes/:sceneId/lighting', () => {
    it('returns authored lights to players (editor list route is DM-only)', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/lights`)
        .set('Cookie', dmCookies)
        .send({ emitterType: 'torch', x: 100, y: 120 })
        .expect(201);

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/lighting`)
        .set('Cookie', playerCookies)
        .expect(200);

      const { data } = res.body as { data: SceneLighting };
      expect(data.authored).toHaveLength(1);
      expect(data.authored[0]).toMatchObject({
        x: 100,
        y: 120,
        emitterType: 'torch',
        color: LIGHT_PRESETS.torch.color,
      });
      expect(typeof data.authored[0]?.animationSeed).toBe('number');
      expect(data.temporary).toEqual([]);
    });

    it('rejects non-members', async () => {
      await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/lighting`)
        .set('Cookie', outsiderCookies)
        .expect(403);
    });

    it('returns 404 for a scene outside the campaign', async () => {
      await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${UNKNOWN_UUID}/lighting`)
        .set('Cookie', dmCookies)
        .expect(404);
    });
  });

  describe('temporary light sockets', () => {
    it('DM creates a light; the room receives a snapshot and REST includes it', async () => {
      const dm = await joinedSocket(dmCookies);
      const player = await joinedSocket(playerCookies);

      const updated = waitForEvent<TemporaryLightsUpdatedPayload>(player, LIGHT_EVENTS.LIGHT_UPDATED);
      dm.emit(LIGHT_EVENTS.LIGHT_CREATE, { campaignId, sceneId, emitterType: 'lantern', x: 50, y: 60 });
      const payload = await updated;

      expect(payload.sceneId).toBe(sceneId);
      expect(payload.lights).toHaveLength(1);
      expect(payload.lights[0]).toMatchObject({
        x: 50,
        y: 60,
        emitterType: 'lantern',
        radius: LIGHT_PRESETS.lantern.radius,
      });

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/lighting`)
        .set('Cookie', playerCookies);
      expect((res.body as { data: SceneLighting }).data.temporary).toHaveLength(1);
    });

    it('DM updates and deletes a light', async () => {
      const dm = await joinedSocket(dmCookies);

      const created = waitForEvent<TemporaryLightsUpdatedPayload>(dm, LIGHT_EVENTS.LIGHT_UPDATED);
      dm.emit(LIGHT_EVENTS.LIGHT_CREATE, { campaignId, sceneId, emitterType: 'torch', x: 1, y: 1 });
      const lightId = (await created).lights[0]?.id;

      const updated = waitForEvent<TemporaryLightsUpdatedPayload>(dm, LIGHT_EVENTS.LIGHT_UPDATED);
      dm.emit(LIGHT_EVENTS.LIGHT_UPDATE, { campaignId, sceneId, lightId, changes: { intensity: 0.25 } });
      expect((await updated).lights[0]?.intensity).toBe(0.25);

      const deleted = waitForEvent<TemporaryLightsUpdatedPayload>(dm, LIGHT_EVENTS.LIGHT_UPDATED);
      dm.emit(LIGHT_EVENTS.LIGHT_DELETE, { campaignId, sceneId, lightId });
      expect((await deleted).lights).toEqual([]);
    });

    it.each([
      [LIGHT_EVENTS.LIGHT_UPDATE, { lightId: UNKNOWN_UUID, changes: { intensity: 1 } }],
      [LIGHT_EVENTS.LIGHT_DELETE, { lightId: UNKNOWN_UUID }],
    ])('rejects %s from a player with FORBIDDEN', async (event, extra) => {
      const player = await joinedSocket(playerCookies);
      const error = waitForEvent<SocketErrorPayload>(player, PLAY_AREA_EVENTS.ERROR);
      player.emit(event, { campaignId, sceneId, ...extra });
      expect((await error).code).toBe('FORBIDDEN');
    });

    it('rejects a well-formed create from a player with FORBIDDEN and broadcasts nothing', async () => {
      const dm = await joinedSocket(dmCookies);
      const player = await joinedSocket(playerCookies);
      let broadcast = false;
      dm.once(LIGHT_EVENTS.LIGHT_UPDATED, () => {
        broadcast = true;
      });

      const error = waitForEvent<SocketErrorPayload>(player, PLAY_AREA_EVENTS.ERROR);
      player.emit(LIGHT_EVENTS.LIGHT_CREATE, { campaignId, sceneId, emitterType: 'torch', x: 0, y: 0 });
      expect((await error).code).toBe('FORBIDDEN');
      await new Promise<void>((r) => setTimeout(r, NO_EVENT_WAIT_MS));
      expect(broadcast).toBe(false);
    });

    it('rejects invalid payloads', async () => {
      const dm = await joinedSocket(dmCookies);
      const error = waitForEvent<SocketErrorPayload>(dm, PLAY_AREA_EVENTS.ERROR);
      dm.emit(LIGHT_EVENTS.LIGHT_CREATE, { campaignId, sceneId, emitterType: 'sun', x: 0, y: 0 });
      expect((await error).code).toBe('INVALID_PAYLOAD');
    });

    it('rejects a scene outside the campaign', async () => {
      const dm = await joinedSocket(dmCookies);
      const error = waitForEvent<SocketErrorPayload>(dm, PLAY_AREA_EVENTS.ERROR);
      dm.emit(LIGHT_EVENTS.LIGHT_CREATE, {
        campaignId,
        sceneId: UNKNOWN_UUID,
        emitterType: 'torch',
        x: 0,
        y: 0,
      });
      expect((await error).code).toBe('NOT_FOUND');
    });

    it('returns NOT_FOUND when updating an unknown light', async () => {
      const dm = await joinedSocket(dmCookies);
      const error = waitForEvent<SocketErrorPayload>(dm, PLAY_AREA_EVENTS.ERROR);
      dm.emit(LIGHT_EVENTS.LIGHT_UPDATE, {
        campaignId,
        sceneId,
        lightId: UNKNOWN_UUID,
        changes: { radius: 3 },
      });
      expect((await error).code).toBe('NOT_FOUND');
    });

    it('does not let a light be edited through a different scene id', async () => {
      const dm = await joinedSocket(dmCookies);
      const created = waitForEvent<TemporaryLightsUpdatedPayload>(dm, LIGHT_EVENTS.LIGHT_UPDATED);
      dm.emit(LIGHT_EVENTS.LIGHT_CREATE, { campaignId, sceneId, emitterType: 'torch', x: 1, y: 1 });
      const lightId = (await created).lights[0]?.id;

      const otherScene = await prisma.scene.create({
        data: { campaignId, name: 'Other', width: 100, height: 100 },
      });
      const error = waitForEvent<SocketErrorPayload>(dm, PLAY_AREA_EVENTS.ERROR);
      dm.emit(LIGHT_EVENTS.LIGHT_DELETE, { campaignId, sceneId: otherScene.id, lightId });
      expect((await error).code).toBe('NOT_FOUND');
    });

    it('rejects a payload for a campaign the socket has not joined', async () => {
      const dm = await joinedSocket(dmCookies);
      const error = waitForEvent<SocketErrorPayload>(dm, PLAY_AREA_EVENTS.ERROR);
      dm.emit(LIGHT_EVENTS.LIGHT_CREATE, {
        campaignId: UNKNOWN_UUID,
        sceneId,
        emitterType: 'torch',
        x: 0,
        y: 0,
      });
      expect((await error).code).toBe('FORBIDDEN');
    });

    it('rejects create from an observer', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: 'lightoutsider@test.com', role: 'observer' });
      const observer = await joinedSocket(outsiderCookies);
      const error = waitForEvent<SocketErrorPayload>(observer, PLAY_AREA_EVENTS.ERROR);
      observer.emit(LIGHT_EVENTS.LIGHT_CREATE, { campaignId, sceneId, emitterType: 'torch', x: 0, y: 0 });
      expect((await error).code).toBe('FORBIDDEN');
    });

    it('enforces the per-scene temporary light limit', async () => {
      const dm = await joinedSocket(dmCookies);
      for (let i = 0; i < MAX_TEMPORARY_LIGHTS_PER_SCENE; i++) {
        const ack = waitForEvent<TemporaryLightsUpdatedPayload>(dm, LIGHT_EVENTS.LIGHT_UPDATED);
        dm.emit(LIGHT_EVENTS.LIGHT_CREATE, { campaignId, sceneId, emitterType: 'torch', x: i, y: 0 });
        await ack;
      }
      const error = waitForEvent<SocketErrorPayload>(dm, PLAY_AREA_EVENTS.ERROR);
      dm.emit(LIGHT_EVENTS.LIGHT_CREATE, { campaignId, sceneId, emitterType: 'torch', x: 0, y: 0 });
      expect((await error).code).toBe('LIGHT_LIMIT_REACHED');
    });
  });
});
