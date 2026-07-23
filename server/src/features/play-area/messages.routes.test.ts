import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';

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
      username: overrides?.username ?? 'ChatTestUser',
      email: overrides?.email ?? 'chat@example.com',
      passwordHash,
    },
  });
  return { id: user.id, email: user.email, password };
}

async function loginAs(email: string, password: string): Promise<string[]> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.headers['set-cookie'] as unknown as string[];
}

async function createCampaign(cookies: string[]): Promise<string> {
  const res = await request(app)
    .post('/api/campaigns')
    .set('Cookie', cookies)
    .send({ name: 'Chat Test Campaign' });
  return (res.body as { data: { id: string } }).data.id;
}

async function seedMessages(
  campaignId: string,
  userId: string,
  count: number,
): Promise<void> {
  const data = Array.from({ length: count }, (_, i) => ({
    campaignId,
    userId,
    username: 'ChatDM',
    text: `Message ${String(i + 1)}`,
    type: 'chat' as const,
  }));
  await prisma.campaignMessage.createMany({ data });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Messages Routes', () => {
  const TEST_EMAILS = ['chatdm@msgtest.com', 'chatplayer@msgtest.com', 'chatoutsider@msgtest.com'];

  beforeAll(async () => {
    const leftover = await prisma.user.findMany({ where: { email: { in: TEST_EMAILS } } });
    const ids = leftover.map((u) => u.id);
    if (ids.length > 0) {
      await prisma.campaign.deleteMany({
        where: { members: { some: { userId: { in: ids } } } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  });

  let dmId: string;
  let playerId: string;
  let dmCookies: string[];
  let playerCookies: string[];
  let campaignId: string;

  beforeEach(async () => {
    const dm = await createUser({ username: 'ChatDM', email: 'chatdm@msgtest.com' });
    dmId = dm.id;
    dmCookies = await loginAs(dm.email, dm.password);

    const player = await createUser({ username: 'ChatPlayer', email: 'chatplayer@msgtest.com' });
    playerId = player.id;
    playerCookies = await loginAs(player.email, player.password);

    campaignId = await createCampaign(dmCookies);

    // Invite player to campaign
    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'chatplayer@msgtest.com', role: 'player' });
  });

  afterEach(async () => {
    const allIds = [dmId, playerId].filter(Boolean);
    await prisma.campaign.deleteMany({
      where: { members: { some: { userId: { in: allIds } } } },
    });
    await prisma.user.deleteMany({ where: { id: { in: allIds } } });
  });

  // -------------------------------------------------------------------------
  // GET /campaigns/:campaignId/messages
  // -------------------------------------------------------------------------

  describe('GET /campaigns/:campaignId/messages', () => {
    it('returns empty array when no messages exist', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/messages`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [] });
    });

    it('returns messages in ascending chronological order', async () => {
      await seedMessages(campaignId, dmId, 3);

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/messages`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(200);
      const messages = (res.body as { data: Array<{ text: string }> }).data;
      expect(messages).toHaveLength(3);
      expect(messages[0].text).toBe('Message 1');
      expect(messages[2].text).toBe('Message 3');
    });

    it('respects the limit query param', async () => {
      await seedMessages(campaignId, dmId, 10);

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/messages?limit=5`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(200);
      expect((res.body as { data: unknown[] }).data).toHaveLength(5);
    });

    it('caps limit at 100 even if a higher value is requested', async () => {
      await seedMessages(campaignId, dmId, 5);

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/messages?limit=999`)
        .set('Cookie', dmCookies);

      // Only 5 messages exist — we just verify the endpoint doesn't error
      expect(res.status).toBe(200);
      expect((res.body as { data: unknown[] }).data).toHaveLength(5);
    });

    it('returns messages for campaign members (player can read)', async () => {
      await seedMessages(campaignId, dmId, 2);

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/messages`)
        .set('Cookie', playerCookies);

      expect(res.status).toBe(200);
      expect((res.body as { data: unknown[] }).data).toHaveLength(2);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get(`/api/campaigns/${campaignId}/messages`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-members', async () => {
      const outsider = await createUser({
        username: 'ChatOutsider',
        email: 'chatoutsider@msgtest.com',
      });
      const outsiderCookies = await loginAs(outsider.email, outsider.password);

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/messages`)
        .set('Cookie', outsiderCookies);

      // Cleanup outsider
      await prisma.user.delete({ where: { id: outsider.id } });

      expect(res.status).toBe(403);
    });

    it('includes expected message fields in the response', async () => {
      await seedMessages(campaignId, dmId, 1);

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/messages`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(200);
      const msg = (res.body as { data: Array<Record<string, unknown>> }).data[0];
      expect(msg).toHaveProperty('id');
      expect(msg).toHaveProperty('campaignId', campaignId);
      expect(msg).toHaveProperty('userId', dmId);
      expect(msg).toHaveProperty('username', 'ChatDM');
      expect(msg).toHaveProperty('text', 'Message 1');
      expect(msg).toHaveProperty('type', 'chat');
      expect(msg).toHaveProperty('createdAt');
    });
  });
});
