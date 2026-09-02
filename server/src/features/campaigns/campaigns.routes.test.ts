import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';

// Helpers

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

describe('Campaign Routes', () => {
  // Clean up any leftover data from previous (aborted) runs
  beforeAll(async () => {
    const TEST_USERNAMES = ['Camp_DM', 'Camp_Player', 'Camp_Outsider', 'Camp_Outsider2'];
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
  let dmEmail: string;
  let dmPassword: string;
  let dmCookies: string[];

  let playerId: string;
  let playerEmail: string;
  let playerPassword: string;
  let playerCookies: string[];

  beforeEach(async () => {
    const dm = await createUser({ username: 'Camp_DM', email: 'dm@campaigns-test.com' });
    dmId = dm.id;
    dmEmail = dm.email;
    dmPassword = dm.password;
    dmCookies = await loginAs(dmEmail, dmPassword);

    const player = await createUser({
      username: 'Camp_Player',
      email: 'player@campaigns-test.com',
    });
    playerId = player.id;
    playerEmail = player.email;
    playerPassword = player.password;
    playerCookies = await loginAs(playerEmail, playerPassword);
  });

  afterEach(async () => {
    // Cascade delete removes campaign_players automatically
    await prisma.campaign.deleteMany({
      where: {
        members: {
          some: { userId: { in: [dmId, playerId] } },
        },
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: [dmId, playerId] } } });
  });

  // -------------------------------------------------------------------------
  // POST /api/campaigns
  // -------------------------------------------------------------------------

  describe('POST /api/campaigns', () => {
    it('creates a campaign and assigns DM role to creator', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'Test Campaign', description: 'A test' })
        .expect(201);

      expect(res.body.data).toMatchObject({
        name: 'Test Campaign',
        description: 'A test',
        role: 'dm',
      });
      expect(res.body.data.id).toBeTruthy();
    });

    it('returns 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ description: 'No name' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app).post('/api/campaigns').send({ name: 'Test Campaign' }).expect(401);
    });

    it('creates campaign without description', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'No Description' })
        .expect(201);

      expect(res.body.data.name).toBe('No Description');
      expect(res.body.data.description).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/campaigns
  // -------------------------------------------------------------------------

  describe('GET /api/campaigns', () => {
    it('lists campaigns the user belongs to', async () => {
      // Create a campaign as DM
      const created = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'My Campaign' });

      const campaignId: string = created.body.data.id;

      const res = await request(app).get('/api/campaigns').set('Cookie', dmCookies).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      const found = (res.body.data as { id: string }[]).find((c) => c.id === campaignId);
      expect(found).toBeTruthy();
      expect(found).toMatchObject({ name: 'My Campaign', role: 'dm' });
    });

    it('returns empty array when user has no campaigns', async () => {
      const res = await request(app).get('/api/campaigns').set('Cookie', playerCookies).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data).toHaveLength(0);
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app).get('/api/campaigns').expect(401);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/campaigns/:id
  // -------------------------------------------------------------------------

  describe('GET /api/campaigns/:id', () => {
    let campaignId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'Detail Campaign' });
      campaignId = res.body.data.id;
    });

    it('returns campaign detail with members for DM', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Cookie', dmCookies)
        .expect(200);

      expect(res.body.data.id).toBe(campaignId);
      expect(res.body.data.role).toBe('dm');
      expect(res.body.data.members).toBeInstanceOf(Array);
      expect(res.body.data.members).toHaveLength(1);
      expect(res.body.data.members[0].role).toBe('dm');
    });

    it('includes color on members (Phase 4J)', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Cookie', dmCookies)
        .expect(200);

      // DM was assigned the first palette color on campaign creation
      expect(res.body.data.members[0].color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('returns 403 when user is not a member', async () => {
      await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Cookie', playerCookies)
        .expect(403);
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app).get(`/api/campaigns/${campaignId}`).expect(401);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/campaigns/:id
  // -------------------------------------------------------------------------

  describe('PUT /api/campaigns/:id', () => {
    let campaignId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'Original Name' });
      campaignId = res.body.data.id;

      // Add player as member
      await prisma.campaignPlayer.create({
        data: { campaignId, userId: playerId, role: 'player' },
      });
    });

    it('allows DM to update campaign name', async () => {
      const res = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Cookie', dmCookies)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated Name');
    });

    it('returns 403 when player tries to update', async () => {
      await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Cookie', playerCookies)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('returns 400 for invalid update payload', async () => {
      const res = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Cookie', dmCookies)
        .send({ name: '' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/campaigns/:id
  // -------------------------------------------------------------------------

  describe('DELETE /api/campaigns/:id', () => {
    let campaignId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'To Delete' });
      campaignId = res.body.data.id;

      await prisma.campaignPlayer.create({
        data: { campaignId, userId: playerId, role: 'player' },
      });
    });

    it('allows DM to delete campaign', async () => {
      await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set('Cookie', dmCookies)
        .expect(204);

      // Campaign should be gone
      const gone = await prisma.campaign.findUnique({ where: { id: campaignId } });
      expect(gone).toBeNull();
    });

    it('cascades and removes campaign players on delete', async () => {
      await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set('Cookie', dmCookies)
        .expect(204);

      const memberships = await prisma.campaignPlayer.findMany({ where: { campaignId } });
      expect(memberships).toHaveLength(0);
    });

    it('returns 403 when player tries to delete', async () => {
      await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set('Cookie', playerCookies)
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/campaigns/:id/invite
  // -------------------------------------------------------------------------

  describe('POST /api/campaigns/:id/invite', () => {
    let campaignId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'Invite Campaign' });
      campaignId = res.body.data.id;
    });

    it('DM can invite a user by email as player', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: playerEmail, role: 'player' })
        .expect(201);

      expect(res.body.data).toMatchObject({
        campaignId,
        userId: playerId,
        role: 'player',
        username: 'Camp_Player',
      });
    });

    it('assigns a palette color to the invited member (Phase 4J)', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: playerEmail, role: 'player' })
        .expect(201);

      // color should be a 6-digit hex string from the palette
      expect(res.body.data.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('DM can invite a user as observer', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: playerEmail, role: 'observer' })
        .expect(201);

      expect(res.body.data.role).toBe('observer');
    });

    it('returns 422 when email does not match a user', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: 'nobody@nowhere.com', role: 'player' })
        .expect(422);

      expect(res.body.error.code).toBe('INVITE_FAILED');
    });

    it('returns 409 when user is already a member', async () => {
      await prisma.campaignPlayer.create({
        data: { campaignId, userId: playerId, role: 'player' },
      });

      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: playerEmail, role: 'player' })
        .expect(409);

      expect(res.body.error.code).toBe('ALREADY_MEMBER');
    });

    it('returns 400 for invalid invite payload', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: 'not-an-email', role: 'player' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when role is dm', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: playerEmail, role: 'dm' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 403 when non-DM tries to invite', async () => {
      await prisma.campaignPlayer.create({
        data: { campaignId, userId: playerId, role: 'player' },
      });

      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', playerCookies)
        .send({ email: dmEmail, role: 'player' })
        .expect(403);
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .send({ email: playerEmail, role: 'player' })
        .expect(401);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/campaigns/:id/members/:userId
  // -------------------------------------------------------------------------

  describe('DELETE /api/campaigns/:id/members/:userId', () => {
    let campaignId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'Remove Member Campaign' });
      campaignId = res.body.data.id;

      await prisma.campaignPlayer.create({
        data: { campaignId, userId: playerId, role: 'player' },
      });
    });

    it('DM can remove a member', async () => {
      await request(app)
        .delete(`/api/campaigns/${campaignId}/members/${playerId}`)
        .set('Cookie', dmCookies)
        .expect(204);

      const membership = await prisma.campaignPlayer.findUnique({
        where: { campaignId_userId: { campaignId, userId: playerId } },
      });
      expect(membership).toBeNull();
    });

    it('returns 403 when DM tries to remove themselves', async () => {
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}/members/${dmId}`)
        .set('Cookie', dmCookies)
        .expect(403);

      expect(res.body.error.code).toBe('CANNOT_REMOVE_DM');
    });

    it('returns 404 when member does not exist in campaign', async () => {
      const outsider = await createUser({
        username: 'Camp_Outsider',
        email: 'outsider@campaigns-test.com',
      });
      try {
        const res = await request(app)
          .delete(`/api/campaigns/${campaignId}/members/${outsider.id}`)
          .set('Cookie', dmCookies)
          .expect(404);

        expect(res.body.error.code).toBe('NOT_FOUND');
      } finally {
        await prisma.user.delete({ where: { id: outsider.id } });
      }
    });

    it('returns 403 when player tries to remove a member', async () => {
      await request(app)
        .delete(`/api/campaigns/${campaignId}/members/${dmId}`)
        .set('Cookie', playerCookies)
        .expect(403);
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app).delete(`/api/campaigns/${campaignId}/members/${playerId}`).expect(401);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/campaigns/:id/leave
  // -------------------------------------------------------------------------

  describe('POST /api/campaigns/:id/leave', () => {
    let campaignId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'Leave Campaign' });
      campaignId = res.body.data.id;

      await prisma.campaignPlayer.create({
        data: { campaignId, userId: playerId, role: 'player' },
      });
    });

    it('player can leave a campaign', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/leave`)
        .set('Cookie', playerCookies)
        .expect(204);

      const membership = await prisma.campaignPlayer.findUnique({
        where: { campaignId_userId: { campaignId, userId: playerId } },
      });
      expect(membership).toBeNull();
    });

    it('returns 403 when DM tries to leave', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/leave`)
        .set('Cookie', dmCookies)
        .expect(403);

      expect(res.body.error.code).toBe('DM_CANNOT_LEAVE');
    });

    it('returns 403 when non-member tries to leave', async () => {
      const outsider = await createUser({
        username: 'Camp_Outsider2',
        email: 'outsider2@campaigns-test.com',
      });
      try {
        const outsiderCookies = await loginAs(outsider.email, outsider.password);

        await request(app)
          .post(`/api/campaigns/${campaignId}/leave`)
          .set('Cookie', outsiderCookies)
          .expect(403);
      } finally {
        await prisma.user.delete({ where: { id: outsider.id } });
      }
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app).post(`/api/campaigns/${campaignId}/leave`).expect(401);
    });
  });

  // -------------------------------------------------------------------------
  // Phase 4G: Invite auto-creates player token
  // -------------------------------------------------------------------------

  describe('POST /api/campaigns/:id/invite — player token auto-creation', () => {
    let campaignId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'Token Auto-Create Campaign' });
      campaignId = res.body.data.id;
    });

    it('auto-creates a player token when a player is invited', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: playerEmail, role: 'player' })
        .expect(201);

      const token = await prisma.token.findFirst({
        where: { campaignId, ownerId: playerId, type: 'player' },
      });

      expect(token).not.toBeNull();
      expect(token?.name).toBe('Camp_Player');
      expect(token?.type).toBe('player');
      expect(token?.ownerId).toBe(playerId);
    });

    it('auto-created token is placed on the active scene', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: playerEmail, role: 'player' })
        .expect(201);

      const scene = await prisma.scene.findFirst({
        where: { campaignId, isActive: true },
      });
      expect(scene).not.toBeNull();

      const token = await prisma.token.findFirst({
        where: { campaignId, ownerId: playerId },
      });
      expect(token?.sceneId).toBe(scene?.id);
    });

    it('does NOT create a token when an observer is invited', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: playerEmail, role: 'observer' })
        .expect(201);

      const token = await prisma.token.findFirst({
        where: { campaignId, ownerId: playerId },
      });
      expect(token).toBeNull();
    });

    it('response still returns the member data (not the token)', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: playerEmail, role: 'player' })
        .expect(201);

      expect(res.body.data).toMatchObject({
        campaignId,
        userId: playerId,
        role: 'player',
        username: 'Camp_Player',
      });
    });

    it('reuses the existing player token when a player is re-invited', async () => {
      // First invite — creates a token
      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: playerEmail, role: 'player' })
        .expect(201);

      const originalToken = await prisma.token.findFirst({
        where: { campaignId, ownerId: playerId, type: 'player' },
      });
      expect(originalToken).not.toBeNull();

      // Remove and re-invite
      await request(app)
        .delete(`/api/campaigns/${campaignId}/members/${playerId}`)
        .set('Cookie', dmCookies)
        .expect(204);

      await request(app)
        .post(`/api/campaigns/${campaignId}/invite`)
        .set('Cookie', dmCookies)
        .send({ email: playerEmail, role: 'player' })
        .expect(201);

      // There should still be exactly one player token owned by this user
      const tokens = await prisma.token.findMany({
        where: { campaignId, ownerId: playerId, type: 'player' },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.id).toBe(originalToken?.id);
    });
  });
});
