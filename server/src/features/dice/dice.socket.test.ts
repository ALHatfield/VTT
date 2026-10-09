import type { AddressInfo } from 'node:net';

import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { ChatReceivedPayload, RollResult, SocketErrorPayload } from '@vtt/shared';
import { CHAT_EVENTS, DICE_EVENTS, PLAY_AREA_EVENTS, ROLL_LABEL_MAX_LENGTH } from '@vtt/shared';

import { app, httpServer } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { loginAsHeader as loginAs } from '../../shared/test-utils/login.js';
import { hashPassword } from '../../shared/utils/password.js';

const DM_EMAIL = 'dicesocketdm@test.com';
const OBSERVER_EMAIL = 'dicesocketobserver@test.com';
const TEST_EMAILS = [DM_EMAIL, OBSERVER_EMAIL];
const PASSWORD = 'password123';

let SERVER_URL: string;

async function cleanupUsers(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { in: TEST_EMAILS } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.campaign.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function createUser(username: string, email: string): Promise<void> {
  await prisma.user.create({
    data: { username, email, passwordHash: await hashPassword(PASSWORD) },
  });
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for event: ${event}`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function joinRoom(cookie: string, campaignId: string): Promise<ClientSocket> {
  const socket = clientIo(SERVER_URL, {
    extraHeaders: { cookie },
    autoConnect: false,
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.connect();
  });
  const joined = waitForEvent(socket, PLAY_AREA_EVENTS.USER_JOINED);
  socket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
  await joined;
  return socket;
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

describe('Dice Socket', () => {
  let dmCookies: string;
  let observerCookies: string;
  let campaignId: string;
  const openSockets: ClientSocket[] = [];

  beforeEach(async () => {
    await createUser('DiceSocketDM', DM_EMAIL);
    await createUser('DiceSocketObserver', OBSERVER_EMAIL);
    dmCookies = await loginAs(DM_EMAIL);
    observerCookies = await loginAs(OBSERVER_EMAIL);

    const res = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Dice Socket Campaign' });
    campaignId = (res.body as { data: { id: string } }).data.id;

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: OBSERVER_EMAIL, role: 'observer' });
  });

  afterEach(async () => {
    for (const s of openSockets) s.disconnect();
    openSockets.length = 0;
    await cleanupUsers();
  });

  it('rolls via dice:roll and broadcasts a persisted roll message', async () => {
    const socket = await joinRoom(dmCookies, campaignId);
    openSockets.push(socket);

    const received = waitForEvent<ChatReceivedPayload>(socket, CHAT_EVENTS.CHAT_RECEIVED);
    socket.emit(DICE_EVENTS.DICE_ROLL, { campaignId, formula: '2d6+3' });
    const { message } = await received;

    expect(DICE_EVENTS.DICE_ROLL).toBe('dice:roll');
    expect(message.type).toBe('roll');
    expect(message.text).toBe('2d6+3');
    const roll = message.rollData as RollResult;
    expect(roll.rolls).toHaveLength(2);
    expect(roll.total).toBe(roll.keptRolls.reduce((a, b) => a + b, 0) + 3);

    const row = await prisma.campaignMessage.findUnique({ where: { id: message.id } });
    expect(row?.type).toBe('roll');
  });

  it('persists and broadcasts the optional roll label (Phase 6C)', async () => {
    const socket = await joinRoom(dmCookies, campaignId);
    openSockets.push(socket);

    const received = waitForEvent<ChatReceivedPayload>(socket, CHAT_EVENTS.CHAT_RECEIVED);
    socket.emit(DICE_EVENTS.DICE_ROLL, { campaignId, formula: 'd20+5', label: 'DEX' });
    const { message } = await received;

    const roll = message.rollData as RollResult;
    expect(roll.label).toBe('DEX');
    expect(roll.modifier).toBe(5);

    const row = await prisma.campaignMessage.findUnique({ where: { id: message.id } });
    expect((row?.rollData as { label?: string }).label).toBe('DEX');
  });

  it('rejects a roll label longer than the limit', async () => {
    const socket = await joinRoom(dmCookies, campaignId);
    openSockets.push(socket);

    const errored = waitForEvent<SocketErrorPayload>(socket, PLAY_AREA_EVENTS.ERROR);
    socket.emit(DICE_EVENTS.DICE_ROLL, {
      campaignId,
      formula: 'd20',
      label: 'x'.repeat(ROLL_LABEL_MAX_LENGTH + 1),
    });
    const err = await errored;

    expect(err.code).toBe('INVALID_PAYLOAD');
  });

  it('still accepts the legacy play-area:dice:roll event name', async () => {
    const socket = await joinRoom(dmCookies, campaignId);
    openSockets.push(socket);

    const received = waitForEvent<ChatReceivedPayload>(socket, CHAT_EVENTS.CHAT_RECEIVED);
    socket.emit(DICE_EVENTS.DICE_ROLL_LEGACY, { campaignId, formula: 'd20' });
    const { message } = await received;

    expect(DICE_EVENTS.DICE_ROLL_LEGACY).toBe('play-area:dice:roll');
    expect(message.type).toBe('roll');
    expect((message.rollData as RollResult).sides).toBe(20);
  });

  it('rejects rolls from observers', async () => {
    const socket = await joinRoom(observerCookies, campaignId);
    openSockets.push(socket);

    const error = waitForEvent<SocketErrorPayload>(socket, PLAY_AREA_EVENTS.ERROR);
    socket.emit(DICE_EVENTS.DICE_ROLL, { campaignId, formula: 'd20' });

    expect((await error).code).toBe('FORBIDDEN');
  });

  it('rejects unparseable formulas', async () => {
    const socket = await joinRoom(dmCookies, campaignId);
    openSockets.push(socket);

    const error = waitForEvent<SocketErrorPayload>(socket, PLAY_AREA_EVENTS.ERROR);
    socket.emit(DICE_EVENTS.DICE_ROLL, { campaignId, formula: 'attack' });

    expect((await error).code).toBe('INVALID_FORMULA');
  });

  it('enforces the per-user roll cooldown', async () => {
    const socket = await joinRoom(dmCookies, campaignId);
    openSockets.push(socket);

    const first = waitForEvent<ChatReceivedPayload>(socket, CHAT_EVENTS.CHAT_RECEIVED);
    socket.emit(DICE_EVENTS.DICE_ROLL, { campaignId, formula: 'd6' });
    await first;

    const error = waitForEvent<SocketErrorPayload>(socket, PLAY_AREA_EVENTS.ERROR);
    socket.emit(DICE_EVENTS.DICE_ROLL, { campaignId, formula: 'd6' });

    expect((await error).code).toBe('ROLL_IN_PROGRESS');
  });
});
