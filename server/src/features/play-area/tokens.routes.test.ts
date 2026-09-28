import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function createUser(overrides?: { username?: string; email?: string }): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  const password = 'password123';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username: overrides?.username ?? 'TestUser',
      email: overrides?.email ?? 'test@example.com',
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
    .send({ name: 'Token Test Campaign' });
  return (res.body as { data: { id: string } }).data.id;
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

describe('Play Area Token Routes', () => {
  // Clean up any leftover data from previous (aborted) runs
  beforeAll(async () => {
    const TEST_USERNAMES = ['Tok_DM', 'Tok_Player', 'Tok_Observer', 'Tok_OtherPlayer', 'Tok_OtherPlayer2', 'Stranger'];
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

  beforeEach(async () => {
    const dm = await createUser({ username: 'Tok_DM', email: 'dm@tokentest.com' });
    dmId = dm.id;
    dmCookies = await loginAs(dm.email, dm.password);

    const player = await createUser({ username: 'Tok_Player', email: 'player@tokentest.com' });
    playerId = player.id;
    playerCookies = await loginAs(player.email, player.password);

    const observer = await createUser({ username: 'Tok_Observer', email: 'observer@tokentest.com' });
    observerId = observer.id;
    observerCookies = await loginAs(observer.email, observer.password);

    campaignId = await createCampaign(dmCookies);

    // Invite player and observer to the campaign
    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'player@tokentest.com', role: 'player' });

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'observer@tokentest.com', role: 'observer' });
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({
      where: { members: { some: { userId: { in: [dmId, playerId, observerId] } } } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [dmId, playerId, observerId] } } });
  });

  // ---------------------------------------------------------------------------
  // GET /api/campaigns/:id/scenes/active
  // ---------------------------------------------------------------------------

  describe('GET /api/campaigns/:id/scenes/active', () => {
    it('returns the active scene (auto-creates if none exists)', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', dmCookies)
        .expect(200);

      const scene = (res.body as { data: { id: string; name: string; isActive: boolean } }).data;
      expect(scene.name).toBe('Default Scene');
      expect(scene.isActive).toBe(true);
    });

    it('returns the same scene on repeated calls (does not create duplicates)', async () => {
      const res1 = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', dmCookies)
        .expect(200);

      const res2 = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', dmCookies)
        .expect(200);

      expect((res1.body as { data: { id: string } }).data.id).toBe(
        (res2.body as { data: { id: string } }).data.id,
      );
    });

    it('allows any campaign member to get the active scene', async () => {
      await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', playerCookies)
        .expect(200);

      await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', observerCookies)
        .expect(200);
    });

    it('returns 403 for non-members', async () => {
      const stranger = await createUser({ username: 'Stranger', email: 'stranger@test.com' });
      const strangerCookies = await loginAs(stranger.email, stranger.password);

      await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/active`)
        .set('Cookie', strangerCookies)
        .expect(403);

      await prisma.user.delete({ where: { id: stranger.id } });
    });
  });

  // ---------------------------------------------------------------------------
  // Token CRUD helpers
  // ---------------------------------------------------------------------------

  async function getSceneId(): Promise<string> {
    const res = await request(app)
      .get(`/api/campaigns/${campaignId}/scenes/active`)
      .set('Cookie', dmCookies);
    return (res.body as { data: { id: string } }).data.id;
  }

  async function createTestToken(
    sceneId: string,
    overrides?: Record<string, unknown>,
  ): Promise<{ id: string; sceneId: string }> {
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
      .set('Cookie', dmCookies)
      .send({ name: 'Test Token', type: 'monster', x: 2, y: 3, ...overrides });
    return (res.body as { data: { id: string; sceneId: string } }).data;
  }

  // ---------------------------------------------------------------------------
  // POST /api/campaigns/:id/scenes/:sceneId/tokens
  // ---------------------------------------------------------------------------

  describe('POST /api/campaigns/:id/scenes/:sceneId/tokens', () => {
    it('DM creates a token successfully', async () => {
      const sceneId = await getSceneId();

      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: 'Goblin', type: 'monster', x: 4, y: 5 })
        .expect(201);

      const token = (res.body as { data: { name: string; type: string; x: number; y: number } })
        .data;
      expect(token.name).toBe('Goblin');
      expect(token.type).toBe('monster');
      expect(token.x).toBe(4);
      expect(token.y).toBe(5);
    });

    it('returns 403 when a Player tries to create a token', async () => {
      const sceneId = await getSceneId();
      await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', playerCookies)
        .send({ name: 'Player Token', type: 'player', x: 0, y: 0 })
        .expect(403);
    });

    it('returns 400 for invalid token data', async () => {
      const sceneId = await getSceneId();
      await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: '', type: 'invalid_type', x: -1, y: 0 })
        .expect(400);
    });

    it('returns 404 for a scene that does not belong to the campaign', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/nonexistent-scene-id/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: 'Token', type: 'npc', x: 0, y: 0 })
        .expect(404);
    });

    it('stores custom color and HP values', async () => {
      const sceneId = await getSceneId();
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: 'Boss', type: 'monster', x: 0, y: 0, color: '#ff4444', hp: 100, maxHp: 100, ac: 18 })
        .expect(201);

      const token = (res.body as { data: { color: string; hp: number; ac: number } }).data;
      expect(token.color).toBe('#ff4444');
      expect(token.hp).toBe(100);
      expect(token.ac).toBe(18);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/campaigns/:id/scenes/:sceneId/tokens
  // ---------------------------------------------------------------------------

  describe('GET /api/campaigns/:id/scenes/:sceneId/tokens', () => {
    it('lists all tokens on the scene', async () => {
      const sceneId = await getSceneId();
      await createTestToken(sceneId, { name: 'Orc' });
      await createTestToken(sceneId, { name: 'Troll' });

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .expect(200);

      // The invite in beforeEach auto-creates a player token for Tok_Player, so there
      // will be at least 2 explicit tokens plus the auto-created one.
      const tokens = (res.body as { data: { name: string }[] }).data;
      const names = tokens.map((t) => t.name);
      expect(names).toContain('Orc');
      expect(names).toContain('Troll');
    });

    it('player and observer can list tokens', async () => {
      const sceneId = await getSceneId();
      await createTestToken(sceneId);

      await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', playerCookies)
        .expect(200);

      await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', observerCookies)
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/campaigns/:id/scenes/:sceneId/tokens/:tokenId/position
  // ---------------------------------------------------------------------------

  describe('PATCH position', () => {
    it('DM can move any token', async () => {
      const sceneId = await getSceneId();
      const token = await createTestToken(sceneId);

      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}/position`)
        .set('Cookie', dmCookies)
        .send({ x: 10, y: 12 })
        .expect(200);

      const updated = (res.body as { data: { x: number; y: number } }).data;
      expect(updated.x).toBe(10);
      expect(updated.y).toBe(12);
    });

    it('Player can move their own token', async () => {
      const sceneId = await getSceneId();
      const token = await createTestToken(sceneId, { type: 'player', ownerId: playerId });

      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}/position`)
        .set('Cookie', playerCookies)
        .send({ x: 5, y: 5 })
        .expect(200);

      const updated = (res.body as { data: { x: number; y: number } }).data;
      expect(updated.x).toBe(5);
    });

    it('Player cannot move a token they do not own', async () => {
      const sceneId = await getSceneId();
      // Token has no owner (DM-controlled monster)
      const token = await createTestToken(sceneId, { type: 'monster' });

      await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}/position`)
        .set('Cookie', playerCookies)
        .send({ x: 5, y: 5 })
        .expect(403);
    });

    it('Observer cannot move any token', async () => {
      const sceneId = await getSceneId();
      const token = await createTestToken(sceneId);

      await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}/position`)
        .set('Cookie', observerCookies)
        .send({ x: 5, y: 5 })
        .expect(403);
    });

    it('returns 400 for negative coordinates', async () => {
      const sceneId = await getSceneId();
      const token = await createTestToken(sceneId);

      await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}/position`)
        .set('Cookie', dmCookies)
        .send({ x: -1, y: 0 })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  // PUT /api/campaigns/:id/scenes/:sceneId/tokens/:tokenId
  // ---------------------------------------------------------------------------

  describe('PUT token update', () => {
    it('DM can update any token', async () => {
      const sceneId = await getSceneId();
      const token = await createTestToken(sceneId);

      const res = await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}`)
        .set('Cookie', dmCookies)
        .send({ name: 'Updated Name', hp: 50 })
        .expect(200);

      const updated = (res.body as { data: { name: string; hp: number } }).data;
      expect(updated.name).toBe('Updated Name');
      expect(updated.hp).toBe(50);
    });

    it('Player can update their own token', async () => {
      const sceneId = await getSceneId();
      const token = await createTestToken(sceneId, { type: 'player', ownerId: playerId });

      await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}`)
        .set('Cookie', playerCookies)
        .send({ hp: 30 })
        .expect(200);
    });

    it('Player cannot update a token they do not own', async () => {
      const sceneId = await getSceneId();
      const token = await createTestToken(sceneId);

      await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}`)
        .set('Cookie', playerCookies)
        .send({ name: 'Hacked' })
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/campaigns/:id/scenes/:sceneId/tokens/:tokenId
  // ---------------------------------------------------------------------------

  describe('DELETE token', () => {
    it('DM can delete a token', async () => {
      const sceneId = await getSceneId();
      const token = await createTestToken(sceneId);

      await request(app)
        .delete(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}`)
        .set('Cookie', dmCookies)
        .expect(204);

      // Verify the specific token is gone (the auto-created player token from invite still exists)
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .expect(200);
      const remaining = (res.body as { data: { id: string }[] }).data;
      expect(remaining.find((t) => t.id === token.id)).toBeUndefined();
    });

    it('Player cannot delete a token', async () => {
      const sceneId = await getSceneId();
      const token = await createTestToken(sceneId);

      await request(app)
        .delete(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}`)
        .set('Cookie', playerCookies)
        .expect(403);
    });

    it('returns 404 for a non-existent token', async () => {
      const sceneId = await getSceneId();

      await request(app)
        .delete(
          `/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/00000000-0000-0000-0000-000000000000`,
        )
        .set('Cookie', dmCookies)
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 4G: Player & NPC token permission matrix
  // ---------------------------------------------------------------------------

  describe('Player token permissions', () => {
    it('player cannot move another player\'s token', async () => {
      const sceneId = await getSceneId();
      // Create a second player and assign them a token
      const otherPlayer = await createUser({ username: 'Tok_OtherPlayer', email: 'other@tokentest.com' });
      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: 'other@tokentest.com', role: 'player' });

      const otherToken = await createTestToken(sceneId, { type: 'player', ownerId: otherPlayer.id });

      await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${otherToken.id}/position`)
        .set('Cookie', playerCookies)
        .send({ x: 3, y: 3 })
        .expect(403);

      await prisma.user.delete({ where: { id: otherPlayer.id } });
    });

    it('player cannot update another player\'s token', async () => {
      const sceneId = await getSceneId();
      const otherPlayer = await createUser({ username: 'Tok_OtherPlayer2', email: 'other2@tokentest.com' });
      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: 'other2@tokentest.com', role: 'player' });

      const otherToken = await createTestToken(sceneId, { type: 'player', ownerId: otherPlayer.id });

      await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${otherToken.id}`)
        .set('Cookie', playerCookies)
        .send({ name: 'Hijacked' })
        .expect(403);

      await prisma.user.delete({ where: { id: otherPlayer.id } });
    });

    it('player cannot move an NPC token (no owner)', async () => {
      const sceneId = await getSceneId();
      const npc = await createTestToken(sceneId, { type: 'npc', name: 'Guard' });

      await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${npc.id}/position`)
        .set('Cookie', playerCookies)
        .send({ x: 2, y: 2 })
        .expect(403);
    });

    it('player cannot update an NPC token', async () => {
      const sceneId = await getSceneId();
      const npc = await createTestToken(sceneId, { type: 'npc', name: 'Shopkeeper' });

      await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${npc.id}`)
        .set('Cookie', playerCookies)
        .send({ name: 'Modified NPC' })
        .expect(403);
    });

    it('DM can move any player token', async () => {
      const sceneId = await getSceneId();
      const playerToken = await createTestToken(sceneId, { type: 'player', ownerId: playerId });

      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${playerToken.id}/position`)
        .set('Cookie', dmCookies)
        .send({ x: 7, y: 7 })
        .expect(200);

      expect((res.body as { data: { x: number } }).data.x).toBe(7);
    });

    it('DM can move an NPC token', async () => {
      const sceneId = await getSceneId();
      const npc = await createTestToken(sceneId, { type: 'npc' });

      await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${npc.id}/position`)
        .set('Cookie', dmCookies)
        .send({ x: 4, y: 4 })
        .expect(200);
    });
  });

  describe('NPC token creation (DM only)', () => {
    it('DM can create an NPC token with no owner', async () => {
      const sceneId = await getSceneId();

      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: 'Town Guard', type: 'npc', x: 0, y: 0 })
        .expect(201);

      const token = (res.body as { data: { name: string; type: string; ownerId: unknown } }).data;
      expect(token.name).toBe('Town Guard');
      expect(token.type).toBe('npc');
      expect(token.ownerId).toBeNull();
    });

    it('player cannot create any token (including NPC)', async () => {
      const sceneId = await getSceneId();

      await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', playerCookies)
        .send({ name: 'Fake NPC', type: 'npc', x: 0, y: 0 })
        .expect(403);
    });

    it('token list response includes ownerName for player tokens', async () => {
      const sceneId = await getSceneId();
      await createTestToken(sceneId, { type: 'player', ownerId: playerId });

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .expect(200);

      const tokens = (res.body as { data: { type: string; ownerName: string | null }[] }).data;
      const playerToken = tokens.find((t) => t.type === 'player');
      expect(playerToken?.ownerName).toBe('Tok_Player');
    });

    it('NPC token has null ownerName in list response', async () => {
      const sceneId = await getSceneId();
      await createTestToken(sceneId, { type: 'npc', name: 'NPC Guard' });

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .expect(200);

      const tokens = (res.body as { data: { type: string; ownerName: string | null }[] }).data;
      const npcToken = tokens.find((t) => t.type === 'npc');
      expect(npcToken?.ownerName).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 4F.2: NPC subtype — ally & enemy
  // ---------------------------------------------------------------------------

  describe('NPC subtype (Phase 4F.2)', () => {
    it('DM can create an ally NPC token', async () => {
      const sceneId = await getSceneId();

      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: 'Town Guard', type: 'npc', x: 0, y: 0, npcSubtype: 'ally' })
        .expect(201);

      const token = (res.body as { data: { type: string; npcSubtype: string | null } }).data;
      expect(token.type).toBe('npc');
      expect(token.npcSubtype).toBe('ally');
    });

    it('DM can create an enemy NPC token', async () => {
      const sceneId = await getSceneId();

      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: 'Goblin', type: 'npc', x: 1, y: 1, npcSubtype: 'enemy' })
        .expect(201);

      const token = (res.body as { data: { npcSubtype: string | null } }).data;
      expect(token.npcSubtype).toBe('enemy');
    });

    it('NPC token without subtype has null npcSubtype in response', async () => {
      const sceneId = await getSceneId();

      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: 'Unknown NPC', type: 'npc', x: 0, y: 0 })
        .expect(201);

      const token = (res.body as { data: { npcSubtype: string | null } }).data;
      expect(token.npcSubtype).toBeNull();
    });

    it('non-NPC token has null npcSubtype in response', async () => {
      const sceneId = await getSceneId();

      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: 'Monster', type: 'monster', x: 0, y: 0 })
        .expect(201);

      const token = (res.body as { data: { npcSubtype: string | null } }).data;
      expect(token.npcSubtype).toBeNull();
    });

    it('returns 400 for invalid npcSubtype value', async () => {
      const sceneId = await getSceneId();

      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: 'Bad NPC', type: 'npc', x: 0, y: 0, npcSubtype: 'neutral' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('DM can update npcSubtype on an NPC token', async () => {
      const sceneId = await getSceneId();
      const token = await createTestToken(sceneId, { type: 'npc', npcSubtype: 'enemy' });

      const res = await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}`)
        .set('Cookie', dmCookies)
        .send({ npcSubtype: 'ally' })
        .expect(200);

      const updated = (res.body as { data: { npcSubtype: string | null } }).data;
      expect(updated.npcSubtype).toBe('ally');
    });

    it('DM can clear npcSubtype on an NPC token (set to null)', async () => {
      const sceneId = await getSceneId();
      const token = await createTestToken(sceneId, { type: 'npc', npcSubtype: 'ally' });

      const res = await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${token.id}`)
        .set('Cookie', dmCookies)
        .send({ npcSubtype: null })
        .expect(200);

      const updated = (res.body as { data: { npcSubtype: string | null } }).data;
      expect(updated.npcSubtype).toBeNull();
    });

    it('player cannot set npcSubtype on their own token', async () => {
      const sceneId = await getSceneId();
      const playerToken = await createTestToken(sceneId, { type: 'player', ownerId: playerId });

      await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${playerToken.id}`)
        .set('Cookie', playerCookies)
        .send({ npcSubtype: 'ally' })
        .expect(403);
    });

    it('returns 400 when npcSubtype is set on a non-NPC token type on create', async () => {
      const sceneId = await getSceneId();

      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`)
        .set('Cookie', dmCookies)
        .send({ name: 'Boss Monster', type: 'monster', x: 0, y: 0, npcSubtype: 'ally' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
