import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { FogExplorationStamp, FogMaskConfig } from '@vtt/shared';
import { DEFAULT_FOG_MASK_CONFIG } from '@vtt/shared';

import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';

const TEST_USERNAMES = ['FogCfg_DM', 'FogCfg_Player', 'FogCfg_Observer'];

async function createUser(username: string, email: string): Promise<{ id: string; email: string }> {
  const user = await prisma.user.create({
    data: { username, email, passwordHash: await hashPassword('password123') },
  });
  return { id: user.id, email: user.email };
}

async function loginAs(email: string): Promise<string[]> {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return res.headers['set-cookie'] as unknown as string[];
}

describe('Fog Config & Exploration Routes (Phase PM2)', () => {
  let dmId: string;
  let playerId: string;
  let observerId: string;
  let dmCookies: string[];
  let playerCookies: string[];
  let observerCookies: string[];
  let campaignId: string;
  let sceneId: string;

  beforeAll(async () => {
    const leftover = await prisma.user.findMany({ where: { username: { in: TEST_USERNAMES } } });
    const leftoverIds = leftover.map((u) => u.id);

    if (leftoverIds.length > 0) {
      await prisma.campaign.deleteMany({
        where: { members: { some: { userId: { in: leftoverIds } } } },
      });
      await prisma.user.deleteMany({ where: { id: { in: leftoverIds } } });
    }
  });

  beforeEach(async () => {
    const dm = await createUser('FogCfg_DM', 'fogcfgdm@test.com');
    dmId = dm.id;
    dmCookies = await loginAs(dm.email);

    const player = await createUser('FogCfg_Player', 'fogcfgplayer@test.com');
    playerId = player.id;
    playerCookies = await loginAs(player.email);

    const observer = await createUser('FogCfg_Observer', 'fogcfgobserver@test.com');
    observerId = observer.id;
    observerCookies = await loginAs(observer.email);

    const campaignRes = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Fog Config Campaign' });
    campaignId = (campaignRes.body as { data: { id: string } }).data.id;

    const sceneRes = await request(app)
      .get(`/api/campaigns/${campaignId}/scenes/active`)
      .set('Cookie', dmCookies)
      .expect(200);
    sceneId = (sceneRes.body as { data: { id: string } }).data.id;

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'fogcfgplayer@test.com', role: 'player' })
      .expect(201);

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'fogcfgobserver@test.com', role: 'observer' })
      .expect(201);
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({
      where: { members: { some: { userId: { in: [dmId, playerId, observerId] } } } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [dmId, playerId, observerId] } } });
  });

  describe('GET /fog/config', () => {
    it('returns the default config for an unconfigured scene', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/config`)
        .set('Cookie', dmCookies)
        .expect(200);

      expect((res.body as { data: FogMaskConfig }).data).toEqual(DEFAULT_FOG_MASK_CONFIG);
    });

    it('is readable by players', async () => {
      await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/config`)
        .set('Cookie', playerCookies)
        .expect(200);
    });
  });

  describe('PATCH /fog/config', () => {
    it('persists a partial update and returns the merged config', async () => {
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/config`)
        .set('Cookie', dmCookies)
        .send({ fogMode: 'pm2', explorationMode: 'persistent' })
        .expect(200);

      expect((res.body as { data: FogMaskConfig }).data).toEqual({
        ...DEFAULT_FOG_MASK_CONFIG,
        fogMode: 'pm2',
        explorationMode: 'persistent',
      });

      const reread = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/config`)
        .set('Cookie', dmCookies)
        .expect(200);

      expect((reread.body as { data: FogMaskConfig }).data.fogMode).toBe('pm2');
    });

    it('rejects an out-of-range mask resolution', async () => {
      await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/config`)
        .set('Cookie', dmCookies)
        .send({ maskResolutionScale: 9 })
        .expect(400);
    });

    it('rejects an empty patch', async () => {
      await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/config`)
        .set('Cookie', dmCookies)
        .send({})
        .expect(400);
    });

    it('forbids players from changing fog settings', async () => {
      await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/config`)
        .set('Cookie', playerCookies)
        .send({ fogMode: 'pm2' })
        .expect(403);
    });
  });

  describe('/fog/exploration', () => {
    it('returns persisted stamps for the scene', async () => {
      await prisma.fogExploration.create({
        data: { campaignId, sceneId, cellKey: '2:3', x: 160, y: 224, radius: 384 },
      });

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/exploration`)
        .set('Cookie', playerCookies)
        .expect(200);

      expect((res.body as { data: FogExplorationStamp[] }).data).toEqual([
        { id: '2:3', x: 160, y: 224, radius: 384, sceneId, campaignId },
      ]);
    });

    it('returns nothing to observers', async () => {
      await prisma.fogExploration.create({
        data: { campaignId, sceneId, cellKey: '2:3', x: 160, y: 224, radius: 384 },
      });

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/exploration`)
        .set('Cookie', observerCookies)
        .expect(200);

      expect((res.body as { data: FogExplorationStamp[] }).data).toEqual([]);
    });

    it('lets the DM reset exploration', async () => {
      await prisma.fogExploration.create({
        data: { campaignId, sceneId, cellKey: '2:3', x: 160, y: 224, radius: 384 },
      });

      await request(app)
        .delete(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/exploration`)
        .set('Cookie', dmCookies)
        .expect(204);

      expect(await prisma.fogExploration.count({ where: { sceneId } })).toBe(0);
    });

    it('forbids players from resetting exploration', async () => {
      await request(app)
        .delete(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/exploration`)
        .set('Cookie', playerCookies)
        .expect(403);
    });

    it('404s for a scene outside the campaign', async () => {
      await request(app)
        .get(
          `/api/campaigns/${campaignId}/scenes/00000000-0000-0000-0000-000000000000/fog/exploration`,
        )
        .set('Cookie', dmCookies)
        .expect(404);
    });

    it('404s when resetting a scene outside the campaign', async () => {
      await request(app)
        .delete(
          `/api/campaigns/${campaignId}/scenes/00000000-0000-0000-0000-000000000000/fog/exploration`,
        )
        .set('Cookie', dmCookies)
        .expect(404);
    });
  });
});
