import type { AddressInfo } from 'node:net';

import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type {
    ChatReceivedPayload,
    FogHiddenPayload,
    FogRevealedPayload,
    PresencePayload,
    SocketErrorPayload,
    TokenMovedPayload,
} from '@vtt/shared';
import { CHAT_EVENTS, FOG_EVENTS, PLAY_AREA_EVENTS } from '@vtt/shared';

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

async function createUser(
  overrides?: { username?: string; email?: string },
): Promise<{ id: string; email: string; password: string }> {
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
});
