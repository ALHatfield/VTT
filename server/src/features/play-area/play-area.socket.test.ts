import type { AddressInfo } from 'node:net';

import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type {
  ChatReceivedPayload,
  DrawClearedPayload,
  DrawStrokeRelayedPayload,
  FogHiddenPayload,
  FogRevealedPayload,
  InitiativeUpdatedPayload,
  MeasureBroadcastPayload,
  PresencePayload,
  SocketErrorPayload,
  TokenMovedPayload,
} from '@vtt/shared';
import {
  AURA_EVENTS,
  CHAT_EVENTS,
  DRAW_EVENTS,
  FOG_EVENTS,
  INITIATIVE_EVENTS,
  MEASURE_EVENTS,
  PLAY_AREA_EVENTS,
} from '@vtt/shared';

import { app, httpServer } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';

let SERVER_URL: string;

// Known email addresses used across all tests in this file — used for cleanup
const TEST_EMAILS = [
  'socketdm@test.com',
  'socketplayer@test.com',
  'outsider@test.com',
  'dm2@test.com',
];

// ---------------------------------------------------------------------------
// Start / stop the HTTP server around the entire suite
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Clean up any leftover data from previous (aborted) runs before starting
  const leftover = await prisma.user.findMany({ where: { email: { in: TEST_EMAILS } } });
  const leftoverIds = leftover.map((u) => u.id);
  if (leftoverIds.length > 0) {
    await prisma.campaign.deleteMany({
      where: { members: { some: { userId: { in: leftoverIds } } } },
    });
    await prisma.user.deleteMany({ where: { id: { in: leftoverIds } } });
  }

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(overrides?: {
  username?: string;
  email?: string;
}): Promise<{ id: string; email: string; password: string }> {
  const password = 'password123';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username: overrides?.username ?? 'SocketTestUser',
      email: overrides?.email ?? 'socket@example.com',
      passwordHash,
    },
  });
  return { id: user.id, email: user.email, password };
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  const cookies = res.headers['set-cookie'] as unknown as string[];
  return cookies.join('; ');
}

async function createCampaign(cookieHeader: string): Promise<string> {
  const res = await request(app)
    .post('/api/campaigns')
    .set('Cookie', cookieHeader)
    .send({ name: 'Socket Test Campaign' });
  return (res.body as { data: { id: string } }).data.id;
}

function connectSocket(cookieHeader: string): ClientSocket {
  return clientIo(SERVER_URL, {
    extraHeaders: { cookie: cookieHeader },
    autoConnect: false,
    reconnection: false,
  });
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event: ${event}`));
    }, timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function connectAndWait(socket: ClientSocket): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.connect();
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Play Area Socket', () => {
  let dmId: string;
  let playerId: string;
  let dmCookies: string;
  let playerCookies: string;
  let campaignId: string;
  const openSockets: ClientSocket[] = [];
  // Track extra users created inside individual tests for cleanup
  const extraUserIds: string[] = [];

  beforeEach(async () => {
    const dm = await createUser({ username: 'SocketDM', email: 'socketdm@test.com' });
    dmId = dm.id;
    dmCookies = await loginAs(dm.email, dm.password);
    campaignId = await createCampaign(dmCookies);

    const player = await createUser({ username: 'SocketPlayer', email: 'socketplayer@test.com' });
    playerId = player.id;
    playerCookies = await loginAs(player.email, player.password);

    // Invite player
    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'socketplayer@test.com', role: 'player' });
  });

  afterEach(async () => {
    // Clean up all open sockets
    for (const s of openSockets) {
      s.disconnect();
    }
    openSockets.length = 0;

    // Clean up test database records
    const allUserIds = [dmId, playerId, ...extraUserIds].filter(Boolean);
    await prisma.campaign.deleteMany({
      where: { members: { some: { userId: { in: allUserIds } } } },
    });
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
    extraUserIds.length = 0;
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe('authentication', () => {
    it('rejects connection without a session cookie', async () => {
      const socket = clientIo(SERVER_URL, { autoConnect: false, reconnection: false });
      openSockets.push(socket);

      await expect(connectAndWait(socket)).rejects.toBeDefined();
    });

    it('accepts connection with a valid session cookie', async () => {
      const socket = connectSocket(dmCookies);
      openSockets.push(socket);

      await expect(connectAndWait(socket)).resolves.toBeUndefined();
      expect(socket.connected).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Room join
  // -------------------------------------------------------------------------

  describe('room join', () => {
    it('rejects join for non-member', async () => {
      const outsider = await createUser({
        username: 'Outsider',
        email: 'outsider@test.com',
      });
      extraUserIds.push(outsider.id);
      const outsiderCookies = await loginAs(outsider.email, outsider.password);
      const socket = connectSocket(outsiderCookies);
      openSockets.push(socket);

      await connectAndWait(socket);

      const errorPromise = waitForEvent<SocketErrorPayload>(socket, PLAY_AREA_EVENTS.ERROR);
      socket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      const error = await errorPromise;

      expect(error.code).toBe('FORBIDDEN');
    });

    it('broadcasts user:joined to existing room members', async () => {
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      // Give DM time to join the room before player connects
      await new Promise<void>((r) => setTimeout(r, 100));

      const joinedPromise = waitForEvent<PresencePayload>(dmSocket, PLAY_AREA_EVENTS.USER_JOINED);

      await connectAndWait(playerSocket);
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });

      const payload = await joinedPromise;
      expect(payload.campaignId).toBe(campaignId);
    });
  });

  // -------------------------------------------------------------------------
  // Token movement
  // -------------------------------------------------------------------------

  describe('token:move broadcast', () => {
    it('broadcasts token:moved to other clients in the same campaign', async () => {
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);

      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });

      // Wait for both sockets to join the room
      await new Promise<void>((r) => setTimeout(r, 150));

      const tokenMovedPromise = waitForEvent<TokenMovedPayload>(
        playerSocket,
        PLAY_AREA_EVENTS.TOKEN_MOVED,
      );

      dmSocket.emit(PLAY_AREA_EVENTS.TOKEN_MOVE, {
        tokenId: 'token-1',
        x: 3,
        y: 4,
        campaignId,
      });

      const moved = await tokenMovedPromise;
      expect(moved.tokenId).toBe('token-1');
      expect(moved.x).toBe(3);
      expect(moved.y).toBe(4);
      expect(moved.campaignId).toBe(campaignId);
    });

    it('does not echo token:moved back to the sender', async () => {
      const dmSocket = connectSocket(dmCookies);
      openSockets.push(dmSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      let receivedEcho = false;
      dmSocket.on(PLAY_AREA_EVENTS.TOKEN_MOVED, () => {
        receivedEcho = true;
      });

      dmSocket.emit(PLAY_AREA_EVENTS.TOKEN_MOVE, {
        tokenId: 'token-1',
        x: 1,
        y: 2,
        campaignId,
      });

      await new Promise<void>((r) => setTimeout(r, 200));
      expect(receivedEcho).toBe(false);
    });

    it('returns error for campaign ID mismatch', async () => {
      const dmSocket = connectSocket(dmCookies);
      openSockets.push(dmSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      const errorPromise = waitForEvent<SocketErrorPayload>(dmSocket, PLAY_AREA_EVENTS.ERROR);

      dmSocket.emit(PLAY_AREA_EVENTS.TOKEN_MOVE, {
        tokenId: 'token-1',
        x: 1,
        y: 2,
        campaignId: '00000000-0000-0000-0000-000000000000', // valid UUID but wrong campaign
      });

      const error = await errorPromise;
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('aura:update broadcast', () => {
    it('lets the DM update a token aura and broadcasts aura:updated', async () => {
      const sceneRes = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', dmCookies);
      const sceneId = (sceneRes.body as { data: { id: string } }).data.id;
      const token = await prisma.token.create({
        data: {
          sceneId,
          campaignId,
          name: 'Aura Socket Token',
          type: 'monster',
          x: 0,
          y: 0,
        },
      });

      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 150));

      const auraUpdatedPromise = waitForEvent<{
        token: { id: string; auraRadius: number; auraColor: string; auraVisible: boolean };
        campaignId: string;
      }>(playerSocket, AURA_EVENTS.AURA_UPDATED);

      dmSocket.emit(AURA_EVENTS.AURA_UPDATE, {
        tokenId: token.id,
        campaignId,
        aura: { radius: 3, color: '#ffd43b', visible: true, type: 'presence' },
      });

      const updated = await auraUpdatedPromise;
      expect(updated.campaignId).toBe(campaignId);
      expect(updated.token.id).toBe(token.id);
      expect(updated.token.auraRadius).toBe(3);
      expect(updated.token.auraColor).toBe('#ffd43b');
      expect(updated.token.auraVisible).toBe(true);
    });

    it('rejects player aura updates', async () => {
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(playerSocket);

      await connectAndWait(playerSocket);
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      const errorPromise = waitForEvent<SocketErrorPayload>(playerSocket, PLAY_AREA_EVENTS.ERROR);

      playerSocket.emit(AURA_EVENTS.AURA_UPDATE, {
        tokenId: 'token-1',
        campaignId,
        aura: { visible: true },
      });

      const error = await errorPromise;
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  // -------------------------------------------------------------------------
  // Room isolation
  // -------------------------------------------------------------------------

  describe('room isolation', () => {
    it('does not send events across different campaigns', async () => {
      // Create a second campaign
      const dm2 = await createUser({ username: 'DM2', email: 'dm2@test.com' });
      extraUserIds.push(dm2.id);
      const dm2Cookies = await loginAs(dm2.email, dm2.password);
      const campaignId2 = await createCampaign(dm2Cookies);

      const socket1 = connectSocket(dmCookies);
      const socket2 = connectSocket(dm2Cookies);
      openSockets.push(socket1, socket2);

      await connectAndWait(socket1);
      await connectAndWait(socket2);

      socket1.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      socket2.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId: campaignId2 });
      await new Promise<void>((r) => setTimeout(r, 150));

      let crossRoomEvent = false;
      socket2.on(PLAY_AREA_EVENTS.TOKEN_MOVED, () => {
        crossRoomEvent = true;
      });

      // DM in campaign 1 moves a token
      socket1.emit(PLAY_AREA_EVENTS.TOKEN_MOVE, {
        tokenId: 'token-x',
        x: 5,
        y: 5,
        campaignId,
      });

      await new Promise<void>((r) => setTimeout(r, 200));
      expect(crossRoomEvent).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Initiative
  // -------------------------------------------------------------------------

  describe('initiative events', () => {
    it('lets the DM start and advance initiative for the campaign room', async () => {
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);

      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((resolve) => setTimeout(resolve, 150));

      const sceneRes = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', dmCookies)
        .expect(200);
      const sceneId = (sceneRes.body as { data: { id: string } }).data.id;

      const playerToken = await prisma.token.create({
        data: {
          sceneId,
          campaignId,
          ownerId: playerId,
          name: 'Rogue',
          type: 'player',
          x: 1,
          y: 1,
        },
      });
      const monsterToken = await prisma.token.create({
        data: {
          sceneId,
          campaignId,
          name: 'Ogre',
          type: 'monster',
          x: 3,
          y: 3,
        },
      });
      await prisma.character.create({
        data: {
          campaignId,
          userId: playerId,
          name: 'Quick Rogue',
          race: 'Halfling',
          class: 'Rogue',
          abilityScores: {
            strength: 8,
            dexterity: 16,
            constitution: 12,
            intelligence: 10,
            wisdom: 10,
            charisma: 13,
          },
          hp: 9,
          maxHp: 9,
        },
      });

      const startPromise = waitForEvent<InitiativeUpdatedPayload>(
        playerSocket,
        INITIATIVE_EVENTS.INITIATIVE_UPDATED,
      );
      dmSocket.emit(INITIATIVE_EVENTS.INITIATIVE_START, {
        campaignId,
        tokenIds: [playerToken.id, monsterToken.id],
      });

      const started = await startPromise;
      expect(started.state.active).toBe(true);
      expect(started.state.order).toHaveLength(2);
      expect(
        started.state.order.find((entry) => entry.tokenId === playerToken.id)?.initiativeModifier,
      ).toBe(3);
      expect(started.state.activeTokenId).toBe(started.state.order[0]?.tokenId);

      const advancePromise = waitForEvent<InitiativeUpdatedPayload>(
        playerSocket,
        INITIATIVE_EVENTS.INITIATIVE_UPDATED,
      );
      dmSocket.emit(INITIATIVE_EVENTS.INITIATIVE_ADVANCE, { campaignId });

      const advanced = await advancePromise;
      expect(advanced.state.activeTokenId).toBe(started.state.order[1]?.tokenId);

      const endPromise = waitForEvent<InitiativeUpdatedPayload>(
        playerSocket,
        INITIATIVE_EVENTS.INITIATIVE_UPDATED,
      );
      dmSocket.emit(INITIATIVE_EVENTS.INITIATIVE_END, { campaignId });

      const ended = await endPromise;
      expect(ended.state.active).toBe(false);
      expect(ended.state.activeTokenId).toBeNull();
      expect(ended.state.order).toEqual([]);
    });

    it('rejects initiative controls from non-DM users', async () => {
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(playerSocket);

      await connectAndWait(playerSocket);
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const errorPromise = waitForEvent<SocketErrorPayload>(playerSocket, PLAY_AREA_EVENTS.ERROR);
      playerSocket.emit(INITIATIVE_EVENTS.INITIATIVE_START, { campaignId });

      const error = await errorPromise;
      expect(error.code).toBe('FORBIDDEN');
    });

    it('rejects ending initiative from non-DM users', async () => {
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(playerSocket);

      await connectAndWait(playerSocket);
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const errorPromise = waitForEvent<SocketErrorPayload>(playerSocket, PLAY_AREA_EVENTS.ERROR);
      playerSocket.emit(INITIATIVE_EVENTS.INITIATIVE_END, { campaignId });

      const error = await errorPromise;
      expect(error.code).toBe('FORBIDDEN');
    });

    it('sends inactive initiative state to clients that join after combat ends', async () => {
      const dmSocket = connectSocket(dmCookies);
      const latePlayerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, latePlayerSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const sceneRes = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', dmCookies)
        .expect(200);
      const sceneId = (sceneRes.body as { data: { id: string } }).data.id;

      const token = await prisma.token.create({
        data: {
          sceneId,
          campaignId,
          name: 'Skeleton',
          type: 'monster',
          x: 2,
          y: 2,
        },
      });

      const startPromise = waitForEvent<InitiativeUpdatedPayload>(
        dmSocket,
        INITIATIVE_EVENTS.INITIATIVE_UPDATED,
      );
      dmSocket.emit(INITIATIVE_EVENTS.INITIATIVE_START, { campaignId, tokenIds: [token.id] });
      await startPromise;

      const endPromise = waitForEvent<InitiativeUpdatedPayload>(
        dmSocket,
        INITIATIVE_EVENTS.INITIATIVE_UPDATED,
      );
      dmSocket.emit(INITIATIVE_EVENTS.INITIATIVE_END, { campaignId });
      await endPromise;

      await connectAndWait(latePlayerSocket);
      const inactivePromise = waitForEvent<InitiativeUpdatedPayload>(
        latePlayerSocket,
        INITIATIVE_EVENTS.INITIATIVE_UPDATED,
      );
      latePlayerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });

      const payload = await inactivePromise;
      expect(payload.state.active).toBe(false);
      expect(payload.state.activeTokenId).toBeNull();
      expect(payload.state.order).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Chat send
  // -------------------------------------------------------------------------

  describe('chat:send', () => {
    it('persists the message and echoes it back to the sender', async () => {
      const dmSocket = connectSocket(dmCookies);
      openSockets.push(dmSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      const receivedPromise = waitForEvent<ChatReceivedPayload>(
        dmSocket,
        CHAT_EVENTS.CHAT_RECEIVED,
      );

      dmSocket.emit(CHAT_EVENTS.CHAT_SEND, { campaignId, text: 'Hello world' });

      const payload = await receivedPromise;
      expect(payload.message.text).toBe('Hello world');
      expect(payload.message.type).toBe('chat');
      expect(payload.message.campaignId).toBe(campaignId);
      expect(payload.message.userId).toBe(dmId);
    });

    it('broadcasts chat:received to all room members', async () => {
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);

      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 150));

      const playerReceivedPromise = waitForEvent<ChatReceivedPayload>(
        playerSocket,
        CHAT_EVENTS.CHAT_RECEIVED,
      );

      dmSocket.emit(CHAT_EVENTS.CHAT_SEND, { campaignId, text: 'Broadcast test' });

      const payload = await playerReceivedPromise;
      expect(payload.message.text).toBe('Broadcast test');
    });

    it('rejects messages with mismatched campaignId', async () => {
      const dmSocket = connectSocket(dmCookies);
      openSockets.push(dmSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      const errorPromise = waitForEvent<SocketErrorPayload>(dmSocket, PLAY_AREA_EVENTS.ERROR);

      dmSocket.emit(CHAT_EVENTS.CHAT_SEND, {
        campaignId: '00000000-0000-0000-0000-000000000000',
        text: 'Should fail',
      });

      const error = await errorPromise;
      expect(error.code).toBe('FORBIDDEN');
    });

    it('rejects messages exceeding 2000 characters', async () => {
      const dmSocket = connectSocket(dmCookies);
      openSockets.push(dmSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      const errorPromise = waitForEvent<SocketErrorPayload>(dmSocket, PLAY_AREA_EVENTS.ERROR);

      dmSocket.emit(CHAT_EVENTS.CHAT_SEND, {
        campaignId,
        text: 'x'.repeat(2001),
      });

      const error = await errorPromise;
      expect(error.code).toBe('INVALID_PAYLOAD');
    });

    it('rejects empty messages', async () => {
      const dmSocket = connectSocket(dmCookies);
      openSockets.push(dmSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      const errorPromise = waitForEvent<SocketErrorPayload>(dmSocket, PLAY_AREA_EVENTS.ERROR);

      dmSocket.emit(CHAT_EVENTS.CHAT_SEND, { campaignId, text: '   ' });

      const error = await errorPromise;
      expect(error.code).toBe('INVALID_PAYLOAD');
    });
  });

  // -------------------------------------------------------------------------
  // Fog of war
  // -------------------------------------------------------------------------

  describe('fog events', () => {
    it('broadcasts fog:revealed to all room members when DM reveals', async () => {
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);

      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 150));

      const revealedPromise = waitForEvent<FogRevealedPayload>(
        playerSocket,
        FOG_EVENTS.FOG_REVEALED,
      );

      // Need a real scene for validation.
      const sceneRes = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', dmCookies)
        .expect(200);
      const sceneId = (sceneRes.body as { data: { id: string } }).data.id;

      dmSocket.emit(FOG_EVENTS.FOG_REVEAL, {
        campaignId,
        sceneId,
        vertices: [
          { x: 10, y: 10 },
          { x: 100, y: 10 },
          { x: 100, y: 100 },
          { x: 10, y: 100 },
        ],
      });

      const payload = await revealedPromise;
      expect(payload.campaignId).toBe(campaignId);
      expect(payload.sceneId).toBe(sceneId);
      expect(payload.region.vertices).toHaveLength(4);
    });

    it('rejects fog:reveal from non-DM users', async () => {
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);

      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 150));

      const sceneRes = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', dmCookies)
        .expect(200);
      const sceneId = (sceneRes.body as { data: { id: string } }).data.id;

      const errorPromise = waitForEvent<SocketErrorPayload>(playerSocket, PLAY_AREA_EVENTS.ERROR);

      playerSocket.emit(FOG_EVENTS.FOG_REVEAL, {
        campaignId,
        sceneId,
        vertices: [
          { x: 10, y: 10 },
          { x: 100, y: 10 },
          { x: 100, y: 100 },
        ],
      });

      const error = await errorPromise;
      expect(error.code).toBe('FORBIDDEN');
    });

    it('broadcasts fog:hidden after hide removes overlapping regions', async () => {
      const dmSocket = connectSocket(dmCookies);
      openSockets.push(dmSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      const sceneRes = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', dmCookies)
        .expect(200);
      const sceneId = (sceneRes.body as { data: { id: string } }).data.id;

      const revealedPromise = waitForEvent<FogRevealedPayload>(dmSocket, FOG_EVENTS.FOG_REVEALED);
      dmSocket.emit(FOG_EVENTS.FOG_REVEAL, {
        campaignId,
        sceneId,
        vertices: [
          { x: 0, y: 0 },
          { x: 120, y: 0 },
          { x: 120, y: 120 },
          { x: 0, y: 120 },
        ],
      });
      await revealedPromise;

      const hiddenPromise = waitForEvent<FogHiddenPayload>(dmSocket, FOG_EVENTS.FOG_HIDDEN);
      dmSocket.emit(FOG_EVENTS.FOG_HIDE, {
        campaignId,
        sceneId,
        vertices: [
          { x: 20, y: 20 },
          { x: 60, y: 20 },
          { x: 60, y: 60 },
          { x: 20, y: 60 },
        ],
      });

      const payload = await hiddenPromise;
      expect(payload.removedRegionIds.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Presence
  // -------------------------------------------------------------------------

  describe('presence', () => {
    it('broadcasts user:left when a socket disconnects', async () => {
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);

      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 150));

      const leftPromise = waitForEvent<PresencePayload>(dmSocket, PLAY_AREA_EVENTS.USER_LEFT);

      playerSocket.disconnect();

      const payload = await leftPromise;
      expect(payload.campaignId).toBe(campaignId);
    });
  });

  // -------------------------------------------------------------------------
  // Measure tool (Phase 4J)
  // -------------------------------------------------------------------------

  describe('measure tool', () => {
    it('relays public measurement broadcast to other room members', async () => {
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);

      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 150));

      const relayPromise = waitForEvent<MeasureBroadcastPayload & { userId: string }>(
        playerSocket,
        MEASURE_EVENTS.MEASURE_RELAYED,
      );

      const measurePayload: MeasureBroadcastPayload = {
        campaignId,
        startX: 100,
        startY: 100,
        endX: 300,
        endY: 300,
        color: '#e03131',
        isPrivate: false,
      };
      dmSocket.emit(MEASURE_EVENTS.MEASURE_BROADCAST, measurePayload);

      const relayed = await relayPromise;
      expect(relayed.campaignId).toBe(campaignId);
      expect(relayed.startX).toBe(100);
      expect(relayed.endX).toBe(300);
      expect(relayed.color).toBe('#e03131');
      expect(relayed.userId).toBe(dmId);
    });

    it('does not echo public broadcast back to sender', async () => {
      const dmSocket = connectSocket(dmCookies);
      openSockets.push(dmSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      let received = false;
      dmSocket.on(MEASURE_EVENTS.MEASURE_RELAYED, () => {
        received = true;
      });

      const measurePayload: MeasureBroadcastPayload = {
        campaignId,
        startX: 50,
        startY: 50,
        endX: 150,
        endY: 150,
        color: '#2f9e44',
        isPrivate: false,
      };
      dmSocket.emit(MEASURE_EVENTS.MEASURE_BROADCAST, measurePayload);

      await new Promise<void>((r) => setTimeout(r, 200));
      expect(received).toBe(false);
    });

    it('relays private measurement only to DM', async () => {
      // player broadcasts private measurement — only DM should see it
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);

      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 150));

      // DM should receive the private relay
      const dmRelayPromise = waitForEvent<MeasureBroadcastPayload & { userId: string }>(
        dmSocket,
        MEASURE_EVENTS.MEASURE_RELAYED,
        1000,
      );

      const measurePayload: MeasureBroadcastPayload = {
        campaignId,
        startX: 200,
        startY: 100,
        endX: 400,
        endY: 200,
        color: '#1971c2',
        isPrivate: true,
      };
      playerSocket.emit(MEASURE_EVENTS.MEASURE_BROADCAST, measurePayload);

      const relayed = await dmRelayPromise;
      expect(relayed.userId).toBe(playerId);
      expect(relayed.isPrivate).toBe(true);
    });

    it('relays measure clear to other room members', async () => {
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);

      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 150));

      const clearPromise = waitForEvent<{ campaignId: string; userId: string }>(
        playerSocket,
        MEASURE_EVENTS.MEASURE_CLEARED,
      );

      dmSocket.emit(MEASURE_EVENTS.MEASURE_CLEAR, { campaignId, isPrivate: false });

      const cleared = await clearPromise;
      expect(cleared.campaignId).toBe(campaignId);
      expect(cleared.userId).toBe(dmId);
    });

    it('emits INVALID_PAYLOAD for malformed measure broadcast', async () => {
      const dmSocket = connectSocket(dmCookies);
      openSockets.push(dmSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      const errorPromise = waitForEvent<SocketErrorPayload>(dmSocket, PLAY_AREA_EVENTS.ERROR);
      // campaignId must be a UUID — 'not-a-uuid' should fail validation
      dmSocket.emit(MEASURE_EVENTS.MEASURE_BROADCAST, {
        campaignId: 'not-a-uuid',
        startX: 100,
        startY: 100,
        endX: 200,
        endY: 200,
        color: '#e03131',
        isPrivate: false,
      });

      const err = await errorPromise;
      expect(err.code).toBe('INVALID_PAYLOAD');
    });
  });

  // -------------------------------------------------------------------------
  // Drawing tool (Phase 4K)
  // -------------------------------------------------------------------------

  describe('draw tool', () => {
    it('relays draw stroke to other clients in the room', async () => {
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 150));

      const relayPromise = waitForEvent<DrawStrokeRelayedPayload>(
        playerSocket,
        DRAW_EVENTS.DRAW_STROKED,
      );

      dmSocket.emit(DRAW_EVENTS.DRAW_STROKE, {
        campaignId,
        strokeId: 'stroke-abc',
        points: [
          { x: 100, y: 100 },
          { x: 150, y: 150 },
        ],
        color: '#ff0000',
        width: 3,
        shapeType: 'freehand',
        isFinal: false,
      });

      const relayed = await relayPromise;
      expect(relayed.strokeId).toBe('stroke-abc');
      expect(relayed.userId).toBe(dmId);
      expect(relayed.shapeType).toBe('freehand');
    });

    it('does not relay draw stroke back to the sender', async () => {
      const dmSocket = connectSocket(dmCookies);
      openSockets.push(dmSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      let received = false;
      dmSocket.on(DRAW_EVENTS.DRAW_STROKED, () => {
        received = true;
      });

      dmSocket.emit(DRAW_EVENTS.DRAW_STROKE, {
        campaignId,
        strokeId: 'stroke-self',
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 20 },
        ],
        color: '#ff0000',
        width: 3,
        shapeType: 'freehand',
        isFinal: true,
      });

      await new Promise<void>((r) => setTimeout(r, 200));
      expect(received).toBe(false);
    });

    it('DM clear all is broadcast to all clients', async () => {
      const dmSocket = connectSocket(dmCookies);
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(dmSocket, playerSocket);

      await connectAndWait(dmSocket);
      await connectAndWait(playerSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 150));

      const dmClearPromise = waitForEvent<DrawClearedPayload>(dmSocket, DRAW_EVENTS.DRAW_CLEARED);
      const playerClearPromise = waitForEvent<DrawClearedPayload>(
        playerSocket,
        DRAW_EVENTS.DRAW_CLEARED,
      );

      dmSocket.emit(DRAW_EVENTS.DRAW_CLEAR, { campaignId, scope: 'all' });

      const [dmCleared, playerCleared] = await Promise.all([dmClearPromise, playerClearPromise]);
      expect(dmCleared.scope).toBe('all');
      expect(dmCleared.userId).toBe(dmId);
      expect(playerCleared.scope).toBe('all');
    });

    it('player clear own is forced to scope own even if all is requested', async () => {
      const playerSocket = connectSocket(playerCookies);
      openSockets.push(playerSocket);

      await connectAndWait(playerSocket);
      playerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      const clearPromise = waitForEvent<DrawClearedPayload>(playerSocket, DRAW_EVENTS.DRAW_CLEARED);

      playerSocket.emit(DRAW_EVENTS.DRAW_CLEAR, { campaignId, scope: 'all' });

      const cleared = await clearPromise;
      // Server must downgrade 'all' → 'own' for non-DM
      expect(cleared.scope).toBe('own');
      expect(cleared.userId).toBe(playerId);
    });

    it('returns INVALID_PAYLOAD for malformed draw stroke', async () => {
      const dmSocket = connectSocket(dmCookies);
      openSockets.push(dmSocket);

      await connectAndWait(dmSocket);
      dmSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      const errorPromise = waitForEvent<SocketErrorPayload>(dmSocket, PLAY_AREA_EVENTS.ERROR);

      dmSocket.emit(DRAW_EVENTS.DRAW_STROKE, {
        campaignId: 'not-a-uuid',
        strokeId: 'x',
        points: [],
        color: 'bad',
        width: 99999,
        shapeType: 'unknown',
        isFinal: true,
      });

      const err = await errorPromise;
      expect(err.code).toBe('INVALID_PAYLOAD');
    });

    it('rejects draw stroke from observer', async () => {
      const outsider = await createUser({
        username: 'Observer4K',
        email: 'observer4k@test.com',
      });
      extraUserIds.push(outsider.id);
      const observerCookies = await loginAs(outsider.email, outsider.password);

      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: outsider.email, role: 'observer' });

      const observerSocket = connectSocket(observerCookies);
      openSockets.push(observerSocket);

      await connectAndWait(observerSocket);
      observerSocket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      await new Promise<void>((r) => setTimeout(r, 100));

      const errorPromise = waitForEvent<SocketErrorPayload>(observerSocket, PLAY_AREA_EVENTS.ERROR);

      observerSocket.emit(DRAW_EVENTS.DRAW_STROKE, {
        campaignId,
        strokeId: 'stroke-obs',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        color: '#ff0000',
        width: 3,
        shapeType: 'freehand',
        isFinal: true,
      });

      const err = await errorPromise;
      expect(err.code).toBe('FORBIDDEN');
    });
  });
});
