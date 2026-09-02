import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';

/**
 * Phase 4F.1 — visionRadius: REST integration tests.
 * Verifies that visionRadius is accepted and returned correctly on token create/update.
 */

async function createUser(
  username: string,
  email: string,
): Promise<{ id: string; cookies: string[] }> {
  const passwordHash = await hashPassword('password123');
  const user = await prisma.user.create({ data: { username, email, passwordHash } });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { id: user.id, cookies: res.headers['set-cookie'] as unknown as string[] };
}

describe('PlayArea Routes — visionRadius (Phase 4F.1)', () => {
  const TEST_EMAIL_DM = 'vr-dm@test.local';

  let dmId: string;
  let dmCookies: string[];
  let campaignId: string;
  let sceneId: string;

  beforeAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL_DM } });
    if (user) {
      await prisma.campaign.deleteMany({
        where: { members: { some: { userId: user.id } } },
      });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  beforeEach(async () => {
    const dm = await createUser('VR_DM', TEST_EMAIL_DM);
    dmId = dm.id;
    dmCookies = dm.cookies;

    const campaignRes = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Vision Radius Test Campaign' });
    campaignId = (campaignRes.body as { data: { id: string } }).data.id;

    const sceneRes = await request(app)
      .get(`/api/campaigns/${campaignId}/scenes/active`)
      .set('Cookie', dmCookies);
    sceneId = (sceneRes.body as { data: { id: string } }).data.id;
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.user.deleteMany({ where: { id: dmId } });
  });

  it('creates a token with the default visionRadius of 6', async () => {
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
      .set('Cookie', dmCookies)
      .send({ name: 'Goblin', type: 'monster', x: 0, y: 0 })
      .expect(201);

    const token = (res.body as { data: { visionRadius: number } }).data;
    expect(token.visionRadius).toBe(6);
  });

  it('creates a token with a custom visionRadius', async () => {
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
      .set('Cookie', dmCookies)
      .send({ name: 'Elf', type: 'player', x: 1, y: 1, visionRadius: 12 })
      .expect(201);

    const token = (res.body as { data: { visionRadius: number } }).data;
    expect(token.visionRadius).toBe(12);
  });

  it('updates a token visionRadius via PUT', async () => {
    const createRes = await request(app)
      .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
      .set('Cookie', dmCookies)
      .send({ name: 'Dwarf', type: 'monster', x: 2, y: 2 })
      .expect(201);

    const tokenId = (createRes.body as { data: { id: string } }).data.id;

    const updateRes = await request(app)
      .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${tokenId}`)
      .set('Cookie', dmCookies)
      .send({ visionRadius: 10 })
      .expect(200);

    const updated = (updateRes.body as { data: { visionRadius: number } }).data;
    expect(updated.visionRadius).toBe(10);
  });

  it('creates and updates token aura fields via PUT', async () => {
    const createRes = await request(app)
      .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
      .set('Cookie', dmCookies)
      .send({
        name: 'Aura Paladin',
        type: 'player',
        x: 1,
        y: 1,
        auraRadius: 2,
        auraColor: '#ffd43b',
        auraVisible: true,
        auraType: 'presence',
      })
      .expect(201);

    const created = (
      createRes.body as {
        data: {
          id: string;
          auraRadius: number;
          auraColor: string;
          auraVisible: boolean;
          auraType: string;
        };
      }
    ).data;
    expect(created.auraRadius).toBe(2);
    expect(created.auraColor).toBe('#ffd43b');
    expect(created.auraVisible).toBe(true);
    expect(created.auraType).toBe('presence');

    const updateRes = await request(app)
      .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${created.id}`)
      .set('Cookie', dmCookies)
      .send({
        auraRadius: 3,
        auraColor: '#cc5de8',
        auraType: 'condition',
        auraCondition: 'poisoned',
      })
      .expect(200);

    const updated = (
      updateRes.body as {
        data: { auraRadius: number; auraColor: string; auraType: string; auraCondition: string };
      }
    ).data;
    expect(updated.auraRadius).toBe(3);
    expect(updated.auraColor).toBe('#cc5de8');
    expect(updated.auraType).toBe('condition');
    expect(updated.auraCondition).toBe('poisoned');
  });

  it('rejects player aura updates on their own token', async () => {
    const player = await createUser('Aura_Player', 'aura-player@test.local');

    try {
      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: 'aura-player@test.local', role: 'player' })
        .expect(201);

      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: 'Player Aura Token', type: 'player', x: 0, y: 0, ownerId: player.id })
        .expect(201);

      const tokenId = (createRes.body as { data: { id: string } }).data.id;

      await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${tokenId}`)
        .set('Cookie', player.cookies)
        .send({ auraRadius: 2, auraColor: '#ffd43b', auraVisible: true })
        .expect(403);
    } finally {
      await prisma.user.deleteMany({ where: { id: player.id } });
    }
  });
});
