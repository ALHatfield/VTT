// Editor routes — Phase 5A / 5B
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';

// Stub jimp so we don't need real image processing in tests
vi.mock('jimp', () => {
  const mockImage = {
    bitmap: { width: 512, height: 512 },
    resize: vi.fn().mockReturnThis(),
    write: vi.fn().mockResolvedValue(undefined),
  };
  return {
    Jimp: {
      read: vi.fn().mockResolvedValue(mockImage),
    },
  };
});

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
      username: overrides?.username ?? 'Editor_User',
      email: overrides?.email ?? 'editor@example.com',
      passwordHash,
    },
  });
  return { id: user.id, email: user.email, password };
}

async function loginAs(email: string, password: string): Promise<string[]> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.headers['set-cookie'] as unknown as string[];
}

const TEST_USERNAMES = ['Editor_DM', 'Editor_Player'];

describe('Editor Routes — Phase 5A', () => {
  beforeAll(async () => {
    // Clean up any leftover data from aborted test runs
    const leftovers = await prisma.user.findMany({
      where: { username: { in: TEST_USERNAMES } },
    });
    const ids = leftovers.map((u) => u.id);
    if (ids.length > 0) {
      await prisma.campaign.deleteMany({
        where: { members: { some: { userId: { in: ids } } } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }

    // Ensure upload dirs exist for tests
    await mkdir(join(process.cwd(), 'uploads', 'assets'), { recursive: true });
    await mkdir(join(process.cwd(), 'uploads', 'thumbnails'), { recursive: true });
  });

  let dmCookies: string[];
  let playerCookies: string[];
  let campaignId: string;

  beforeEach(async () => {
    const dm = await createUser({ username: 'Editor_DM', email: 'dm@editor-test.com' });
    const player = await createUser({
      username: 'Editor_Player',
      email: 'player@editor-test.com',
    });

    dmCookies = await loginAs(dm.email, dm.password);
    playerCookies = await loginAs(player.email, player.password);

    // Create a campaign with dm as owner
    const res = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Editor Test Campaign' });
    campaignId = (res.body as { data: { id: string } }).data.id;

    // Invite player (API expects email + role, not userId)
    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: player.email, role: 'player' });
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({
      where: { members: { some: { user: { username: { in: TEST_USERNAMES } } } } },
    });
    await prisma.user.deleteMany({ where: { username: { in: TEST_USERNAMES } } });
  });

  // -----------------------------------------------------------------------
  // Asset listing
  // -----------------------------------------------------------------------

  describe('GET /api/campaigns/:id/assets', () => {
    it('returns an array for a campaign with no uploaded assets', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/assets`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(200);
      expect(Array.isArray((res.body as { data: unknown[] }).data)).toBe(true);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get(`/api/campaigns/${campaignId}/assets`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid category query param', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/assets?category=invalid`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(400);
    });

    it('allows a player member to list assets', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/assets`)
        .set('Cookie', playerCookies);
      expect(res.status).toBe(200);
    });

    it('filters assets by category', async () => {
      // Seed a bg asset directly
      await prisma.tileAsset.create({
        data: {
          campaignId,
          filename: 'bg.png',
          url: '/uploads/assets/bg.png',
          thumbnailUrl: '/uploads/thumbnails/thumb_bg.webp',
          width: 512,
          height: 512,
          category: 'background',
        },
      });
      await prisma.tileAsset.create({
        data: {
          campaignId,
          filename: 'fg.png',
          url: '/uploads/assets/fg.png',
          thumbnailUrl: '/uploads/thumbnails/thumb_fg.webp',
          width: 64,
          height: 64,
          category: 'foreground',
        },
      });

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/assets?category=background`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(200);
      const assets = (res.body as { data: Array<{ category: string; filename: string }> }).data;
      // All returned assets must be background — no foreground assets leak through
      expect(assets.every((a) => a.category === 'background')).toBe(true);
      // The uploaded bg asset is in the results (built-ins may also appear)
      expect(assets.some((a) => a.filename === 'bg.png')).toBe(true);
      expect(assets.some((a) => a.filename === 'fg.png')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Asset deletion
  // -----------------------------------------------------------------------

  describe('DELETE /api/campaigns/:id/assets/:assetId', () => {
    it('returns 404 for non-existent asset', async () => {
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}/assets/non-existent-id`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(404);
    });

    it('returns 403 when a player tries to delete', async () => {
      const asset = await prisma.tileAsset.create({
        data: {
          campaignId,
          filename: 'test.png',
          url: '/uploads/assets/test.png',
          thumbnailUrl: '/uploads/thumbnails/thumb_test.webp',
          width: 100,
          height: 100,
          category: 'background',
        },
      });

      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}/assets/${asset.id}`)
        .set('Cookie', playerCookies);
      expect(res.status).toBe(403);
    });

    it('deletes an asset and returns 204', async () => {
      const asset = await prisma.tileAsset.create({
        data: {
          campaignId,
          filename: 'todelete.png',
          url: '/uploads/assets/todelete.png',
          thumbnailUrl: '/uploads/thumbnails/thumb_todelete.webp',
          width: 100,
          height: 100,
          category: 'background',
        },
      });

      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}/assets/${asset.id}`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(204);

      const check = await prisma.tileAsset.findUnique({ where: { id: asset.id } });
      expect(check).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Asset upload (validates category in body; file upload is mocked)
  // -----------------------------------------------------------------------

  describe('POST /api/campaigns/:id/assets — validation', () => {
    it('returns 403 when a player tries to upload', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/assets`)
        .set('Cookie', playerCookies)
        .field('category', 'background');
      // No file, so multer returns before our role check — but role check runs first via middleware
      expect(res.status).toBe(403);
    });

    it('returns 400 when no file is attached', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/assets`)
        .set('Cookie', dmCookies)
        .field('category', 'background');
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid category', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/assets`)
        .set('Cookie', dmCookies)
        .field('category', 'invalid_category');
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Phase 5A.1: Built-in asset behaviour
  // -----------------------------------------------------------------------

  describe('Phase 5A.1 — Built-in assets', () => {
    const TEST_BUILTIN_ID = 'test-builtin-asset-001';
    const TEST_UPLOADED_ID = 'test-uploaded-asset-001';

    beforeAll(async () => {
      // Insert a deterministic built-in asset for these tests
      await prisma.tileAsset.upsert({
        where: { id: TEST_BUILTIN_ID },
        update: {},
        create: {
          id: TEST_BUILTIN_ID,
          campaignId: null,
          filename: 'test-builtin-tile.png',
          url: '/tiles/test-builtin-tile.png',
          thumbnailUrl: '/tiles/test-builtin-tile.png',
          width: 256,
          height: 256,
          category: 'background',
          source: 'builtin',
        },
      });
    });

    afterAll(async () => {
      await prisma.tileAsset.deleteMany({
        where: { id: { in: [TEST_BUILTIN_ID, TEST_UPLOADED_ID] } },
      });
    });

    it('list endpoint includes built-in assets alongside uploaded ones', async () => {
      // Insert an uploaded asset for this campaign
      await prisma.tileAsset.create({
        data: {
          id: TEST_UPLOADED_ID,
          campaignId,
          filename: 'uploaded.png',
          url: '/uploads/assets/uploaded.png',
          thumbnailUrl: '/uploads/thumbnails/thumb_uploaded.png',
          width: 128,
          height: 128,
          category: 'background',
          source: 'uploaded',
        },
      });

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/assets`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(200);
      const assets = (res.body as { data: Array<{ id: string; source: string }> }).data;

      const builtinIds = assets.filter((a) => a.source === 'builtin').map((a) => a.id);
      const uploadedIds = assets.filter((a) => a.source === 'uploaded').map((a) => a.id);

      expect(builtinIds).toContain(TEST_BUILTIN_ID);
      expect(uploadedIds).toContain(TEST_UPLOADED_ID);
    });

    it('list endpoint with category filter includes matching built-in assets', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/assets?category=background`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(200);
      const assets = (res.body as { data: Array<{ id: string; source: string; category: string }> })
        .data;

      expect(assets.every((a) => a.category === 'background')).toBe(true);
      const builtinIds = assets.map((a) => a.id);
      expect(builtinIds).toContain(TEST_BUILTIN_ID);
    });

    it('list endpoint with category filter excludes built-in assets of other categories', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/assets?category=foreground`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(200);
      const assets = (res.body as { data: Array<{ id: string }> }).data;
      const ids = assets.map((a) => a.id);
      // TEST_BUILTIN_ID is background — should not appear in foreground results
      expect(ids).not.toContain(TEST_BUILTIN_ID);
    });

    it('delete endpoint rejects deletion of built-in assets with 403', async () => {
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}/assets/${TEST_BUILTIN_ID}`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe('BUILTIN_ASSET');
    });

    it('built-in asset seed is idempotent — re-running upsert does not duplicate', async () => {
      const countBefore = await prisma.tileAsset.count({
        where: { id: TEST_BUILTIN_ID },
      });

      // Re-upsert with same ID
      await prisma.tileAsset.upsert({
        where: { id: TEST_BUILTIN_ID },
        update: {},
        create: {
          id: TEST_BUILTIN_ID,
          campaignId: null,
          filename: 'test-builtin-tile.png',
          url: '/tiles/test-builtin-tile.png',
          thumbnailUrl: '/tiles/test-builtin-tile.png',
          width: 256,
          height: 256,
          category: 'background',
          source: 'builtin',
        },
      });

      const countAfter = await prisma.tileAsset.count({
        where: { id: TEST_BUILTIN_ID },
      });

      expect(countBefore).toBe(1);
      expect(countAfter).toBe(1);
    });

    it('asset list response includes source field on each asset', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/assets`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(200);
      const assets = (res.body as { data: Array<{ source?: string }> }).data;
      expect(assets.length).toBeGreaterThan(0);
      expect(assets.every((a) => a.source === 'uploaded' || a.source === 'builtin')).toBe(true);
    });

    it('GET single asset endpoint resolves built-in by ID', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/assets/${TEST_BUILTIN_ID}`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(200);
      const asset = (res.body as { data: { id: string; source: string; campaignId: null } }).data;
      expect(asset.id).toBe(TEST_BUILTIN_ID);
      expect(asset.source).toBe('builtin');
      expect(asset.campaignId).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 5B — Tile placement routes
// ---------------------------------------------------------------------------

const PLACEMENT_USERNAMES = ['Placement_DM', 'Placement_Player'];

describe('Editor Routes — Phase 5B Tile Placements', () => {
  let dmCookies: string[];
  let playerCookies: string[];
  let campaignId: string;
  let sceneId: string;
  let assetId: string;

  beforeAll(async () => {
    // Clean leftover data
    const leftovers = await prisma.user.findMany({
      where: { username: { in: PLACEMENT_USERNAMES } },
    });
    const ids = leftovers.map((u) => u.id);
    if (ids.length > 0) {
      await prisma.campaign.deleteMany({
        where: { members: { some: { userId: { in: ids } } } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  });

  beforeEach(async () => {
    const dm = await createUser({
      username: 'Placement_DM',
      email: 'dm@placement-test.com',
    });
    const player = await createUser({
      username: 'Placement_Player',
      email: 'player@placement-test.com',
    });

    dmCookies = await loginAs(dm.email, dm.password);
    playerCookies = await loginAs(player.email, player.password);

    // Create campaign
    const campaignRes = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Placement Test Campaign' });
    campaignId = (campaignRes.body as { data: { id: string } }).data.id;

    // Create scene via Prisma directly
    const scene = await prisma.scene.create({
      data: { campaignId, name: 'Test Scene' },
    });
    sceneId = scene.id;

    // Create an asset for this campaign
    const asset = await prisma.tileAsset.create({
      data: {
        campaignId,
        filename: 'tile.png',
        url: '/uploads/assets/tile.png',
        thumbnailUrl: '/uploads/thumbnails/tile.webp',
        width: 64,
        height: 64,
        category: 'background',
      },
    });
    assetId = asset.id;

    // Invite player
    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: player.email, role: 'player' });
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({
      where: { members: { some: { user: { username: { in: PLACEMENT_USERNAMES } } } } },
    });
    await prisma.user.deleteMany({ where: { username: { in: PLACEMENT_USERNAMES } } });
  });

  // Base payload helper
  function basePlacement(overrides?: Record<string, unknown>) {
    return {
      assetId,
      x: 0,
      y: 0,
      width: 64,
      height: 64,
      rotation: 0,
      zIndex: 0,
      category: 'background',
      ...overrides,
    };
  }

  // -----------------------------------------------------------------------
  // List placements
  // -----------------------------------------------------------------------

  describe('GET /api/campaigns/:id/scenes/:sceneId/placements', () => {
    it('returns empty array for a new scene', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(200);
      expect((res.body as { data: unknown[] }).data).toEqual([]);
    });

    it('returns placements after one is created', async () => {
      await prisma.tilePlacement.create({
        data: {
          campaignId,
          sceneId,
          assetId,
          x: 10,
          y: 20,
          width: 64,
          height: 64,
          rotation: 0,
          zIndex: 1,
          category: 'background',
        },
      });

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(200);
      const placements = (res.body as { data: Array<{ x: number; y: number }> }).data;
      expect(placements.length).toBe(1);
      expect(placements[0].x).toBe(10);
      expect(placements[0].y).toBe(20);
    });

    it('allows player members to list placements', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements`)
        .set('Cookie', playerCookies);
      expect(res.status).toBe(200);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get(
        `/api/campaigns/${campaignId}/scenes/${sceneId}/placements`,
      );
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // Create placement
  // -----------------------------------------------------------------------

  describe('POST /api/campaigns/:id/scenes/:sceneId/placements', () => {
    it('creates a placement and returns 201', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements`)
        .set('Cookie', dmCookies)
        .send(basePlacement({ x: 5, y: 10 }));

      expect(res.status).toBe(201);
      const placement = (
        res.body as { data: { id: string; x: number; y: number; sceneId: string } }
      ).data;
      expect(placement.x).toBe(5);
      expect(placement.y).toBe(10);
      expect(placement.sceneId).toBe(sceneId);
      expect(placement.id).toBeTruthy();
    });

    it('returns 403 when a player tries to create', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements`)
        .set('Cookie', playerCookies)
        .send(basePlacement());
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid payload (missing assetId)', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements`)
        .set('Cookie', dmCookies)
        .send({
          x: 0,
          y: 0,
          width: 64,
          height: 64,
          rotation: 0,
          zIndex: 0,
          category: 'background',
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid payload (negative width)', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements`)
        .set('Cookie', dmCookies)
        .send(basePlacement({ width: -10 }));
      expect(res.status).toBe(400);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements`)
        .send(basePlacement());
      expect(res.status).toBe(401);
    });

    it('returns 404 when assetId does not belong to this campaign', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements`)
        .set('Cookie', dmCookies)
        .send(basePlacement({ assetId: '00000000-0000-0000-0000-000000000000' }));
      expect(res.status).toBe(404);
      expect((res.body as { error: { code: string } }).error.code).toBe('ASSET_NOT_FOUND');
    });

    it('returns 404 when sceneId belongs to a different campaign (IDOR guard)', async () => {
      // Create an isolated second campaign with its own scene
      const dm2 = await createUser({ username: 'Placement_DM2', email: 'dm2@placement-test.com' });
      const dmCookies2 = await loginAs(dm2.email, dm2.password);
      const res2 = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies2)
        .send({ name: 'Other Campaign' });
      const otherCampaignId = (res2.body as { data: { id: string } }).data.id;
      const otherScene = await prisma.scene.create({
        data: { campaignId: otherCampaignId, name: 'Other Scene' },
      });

      // DM of campaign A tries to place onto a scene from campaign B
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${otherScene.id}/placements`)
        .set('Cookie', dmCookies)
        .send(basePlacement());
      expect(res.status).toBe(404);

      // Cleanup
      await prisma.campaign.delete({ where: { id: otherCampaignId } });
      await prisma.user.deleteMany({ where: { username: 'Placement_DM2' } });
    });

    it('allows placing a built-in asset', async () => {
      // Insert a deterministic built-in using a valid UUID
      const builtinId = '00000000-0000-0000-0000-000000000001';
      await prisma.tileAsset.upsert({
        where: { id: builtinId },
        update: {},
        create: {
          id: builtinId,
          campaignId: null,
          filename: 'builtin-tile.png',
          url: '/tiles/builtin-tile.png',
          thumbnailUrl: '/tiles/builtin-tile.png',
          width: 64,
          height: 64,
          category: 'background',
          source: 'builtin',
        },
      });

      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements`)
        .set('Cookie', dmCookies)
        .send(basePlacement({ assetId: builtinId }));

      expect(res.status).toBe(201);

      await prisma.tileAsset.delete({ where: { id: builtinId } });
    });
  });

  // -----------------------------------------------------------------------
  // Update placement
  // -----------------------------------------------------------------------

  describe('PATCH /api/campaigns/:id/scenes/:sceneId/placements/:placementId', () => {
    let placementId: string;

    beforeEach(async () => {
      const p = await prisma.tilePlacement.create({
        data: {
          campaignId,
          sceneId,
          assetId,
          x: 0,
          y: 0,
          width: 64,
          height: 64,
          rotation: 0,
          zIndex: 0,
          category: 'background',
        },
      });
      placementId = p.id;
    });

    it('updates placement fields and returns 200', async () => {
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements/${placementId}`)
        .set('Cookie', dmCookies)
        .send({ x: 100, y: 200 });

      expect(res.status).toBe(200);
      const placement = (res.body as { data: { x: number; y: number } }).data;
      expect(placement.x).toBe(100);
      expect(placement.y).toBe(200);
    });

    it('returns 403 when a player tries to update', async () => {
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements/${placementId}`)
        .set('Cookie', playerCookies)
        .send({ x: 100 });
      expect(res.status).toBe(403);
    });

    it('returns 400 for empty update payload', async () => {
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements/${placementId}`)
        .set('Cookie', dmCookies)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent placement', async () => {
      const res = await request(app)
        .patch(
          `/api/campaigns/${campaignId}/scenes/${sceneId}/placements/00000000-0000-0000-0000-000000000000`,
        )
        .set('Cookie', dmCookies)
        .send({ x: 50 });
      expect(res.status).toBe(404);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements/${placementId}`)
        .send({ x: 50 });
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // Delete placement
  // -----------------------------------------------------------------------

  describe('DELETE /api/campaigns/:id/scenes/:sceneId/placements/:placementId', () => {
    let placementId: string;

    beforeEach(async () => {
      const p = await prisma.tilePlacement.create({
        data: {
          campaignId,
          sceneId,
          assetId,
          x: 0,
          y: 0,
          width: 64,
          height: 64,
          rotation: 0,
          zIndex: 0,
          category: 'background',
        },
      });
      placementId = p.id;
    });

    it('deletes a placement and returns 204', async () => {
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements/${placementId}`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(204);

      const check = await prisma.tilePlacement.findUnique({ where: { id: placementId } });
      expect(check).toBeNull();
    });

    it('returns 403 when a player tries to delete', async () => {
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}/scenes/${sceneId}/placements/${placementId}`)
        .set('Cookie', playerCookies);
      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent placement', async () => {
      const res = await request(app)
        .delete(
          `/api/campaigns/${campaignId}/scenes/${sceneId}/placements/00000000-0000-0000-0000-000000000000`,
        )
        .set('Cookie', dmCookies);
      expect(res.status).toBe(404);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).delete(
        `/api/campaigns/${campaignId}/scenes/${sceneId}/placements/${placementId}`,
      );
      expect(res.status).toBe(401);
    });
  });
});
