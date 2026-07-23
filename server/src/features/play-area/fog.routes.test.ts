import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';

async function createUser(overrides?: { username?: string; email?: string }): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  const password = 'password123';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username: overrides?.username ?? 'FogTestUser',
      email: overrides?.email ?? 'fog@example.com',
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
    .send({ name: 'Fog Test Campaign' });
  return (res.body as { data: { id: string } }).data.id;
}

async function getSceneId(campaignId: string, cookies: string[]): Promise<string> {
  const res = await request(app)
    .get(`/api/campaigns/${campaignId}/scenes/active`)
    .set('Cookie', cookies)
    .expect(200);

  return (res.body as { data: { id: string } }).data.id;
}

describe('Fog Routes', () => {
  beforeAll(async () => {
    const TEST_USERNAMES = ['Fog_DM', 'Fog_Player', 'Fog_Observer'];
    const leftover = await prisma.user.findMany({ where: { username: { in: TEST_USERNAMES } } });
    const leftoverIds = leftover.map((u) => u.id);

    if (leftoverIds.length > 0) {
      await prisma.campaign.deleteMany({
        where: { members: { some: { userId: { in: leftoverIds } } } },
      });
      await prisma.user.deleteMany({ where: { id: { in: leftoverIds } } });
    }
  });

  let dmId: string;
  let playerId: string;
  let observerId: string;
  let dmCookies: string[];
  let playerCookies: string[];
  let observerCookies: string[];
  let campaignId: string;
  let sceneId: string;

  beforeEach(async () => {
    const dm = await createUser({ username: 'Fog_DM', email: 'fogdm@test.com' });
    dmId = dm.id;
    dmCookies = await loginAs(dm.email, dm.password);

    const player = await createUser({ username: 'Fog_Player', email: 'fogplayer@test.com' });
    playerId = player.id;
    playerCookies = await loginAs(player.email, player.password);

    const observer = await createUser({ username: 'Fog_Observer', email: 'fogobserver@test.com' });
    observerId = observer.id;
    observerCookies = await loginAs(observer.email, observer.password);

    campaignId = await createCampaign(dmCookies);
    sceneId = await getSceneId(campaignId, dmCookies);

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'fogplayer@test.com', role: 'player' })
      .expect(201);

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'fogobserver@test.com', role: 'observer' })
      .expect(201);
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({
      where: { members: { some: { userId: { in: [dmId, playerId, observerId] } } } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [dmId, playerId, observerId] } } });
  });

  describe('POST /api/campaigns/:id/scenes/:sceneId/fog/reveal', () => {
    it('allows DM to reveal a fog region', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/reveal`)
        .set('Cookie', dmCookies)
        .send({
          vertices: [
            { x: 10, y: 10 },
            { x: 100, y: 10 },
            { x: 100, y: 100 },
            { x: 10, y: 100 },
          ],
        })
        .expect(201);

      const region = (res.body as { data: { id: string; vertices: unknown[] } }).data;
      expect(region.id).toBeTruthy();
      expect(region.vertices).toHaveLength(4);
    });

    it('rejects reveal from player role', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/reveal`)
        .set('Cookie', playerCookies)
        .send({
          vertices: [
            { x: 10, y: 10 },
            { x: 100, y: 10 },
            { x: 100, y: 100 },
          ],
        })
        .expect(403);
    });
  });

  describe('POST /api/campaigns/:id/scenes/:sceneId/fog/hide', () => {
    it('removes overlapping revealed regions', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/reveal`)
        .set('Cookie', dmCookies)
        .send({
          vertices: [
            { x: 0, y: 0 },
            { x: 120, y: 0 },
            { x: 120, y: 120 },
            { x: 0, y: 120 },
          ],
        })
        .expect(201);

      const hideRes = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/hide`)
        .set('Cookie', dmCookies)
        .send({
          vertices: [
            { x: 40, y: 40 },
            { x: 80, y: 40 },
            { x: 80, y: 80 },
            { x: 40, y: 80 },
          ],
        })
        .expect(200);

      const removed = (hideRes.body as { data: { removedRegionIds: string[] } }).data.removedRegionIds;
      expect(removed.length).toBe(1);

      const listRes = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog`)
        .set('Cookie', dmCookies)
        .expect(200);

      expect((listRes.body as { data: unknown[] }).data).toHaveLength(0);
    });

    it('rejects hide from observer role', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/hide`)
        .set('Cookie', observerCookies)
        .send({
          vertices: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
          ],
        })
        .expect(403);
    });
  });

  describe('GET /api/campaigns/:id/scenes/:sceneId/fog', () => {
    it('returns revealed regions to campaign members', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/reveal`)
        .set('Cookie', dmCookies)
        .send({
          vertices: [
            { x: 10, y: 10 },
            { x: 200, y: 10 },
            { x: 200, y: 200 },
            { x: 10, y: 200 },
          ],
        })
        .expect(201);

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog`)
        .set('Cookie', playerCookies)
        .expect(200);

      const regions = (res.body as { data: Array<{ createdByUserId?: string; vertices: unknown[] }> }).data;
      expect(regions).toHaveLength(1);
      expect(regions[0].vertices).toHaveLength(4);
      // Internal author metadata is intentionally not exposed to non-DM clients.
      expect('createdByUserId' in regions[0]).toBe(false);
    });

    it('rejects access for non-members', async () => {
      const outsider = await createUser({ username: 'Fog_Outsider', email: 'fogoutsider@test.com' });
      const outsiderCookies = await loginAs(outsider.email, outsider.password);

      await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog`)
        .set('Cookie', outsiderCookies)
        .expect(403);

      await prisma.user.delete({ where: { id: outsider.id } });
    });
  });
});
