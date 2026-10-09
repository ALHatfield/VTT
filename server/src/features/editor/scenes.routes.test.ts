// Scene library routes — Phase 5H
import { access } from 'node:fs/promises';
import { join } from 'node:path';

import sharp from 'sharp';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { SCENE_NAME_MAX_LENGTH, SCENE_THUMBNAIL_WIDTH } from '@vtt/shared';

import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';

const TEST_USERNAMES = ['Scenes_DM', 'Scenes_Player', 'Scenes_Observer'];
const PASSWORD = 'password123';

async function createUser(username: string, email: string): Promise<string> {
  await prisma.user.create({
    data: { username, email, passwordHash: await hashPassword(PASSWORD) },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return res.headers['set-cookie'] as unknown as string;
}

async function cleanup(): Promise<void> {
  await prisma.campaign.deleteMany({
    where: { members: { some: { user: { username: { in: TEST_USERNAMES } } } } },
  });
  await prisma.user.deleteMany({ where: { username: { in: TEST_USERNAMES } } });
}

describe('Scene Routes — Phase 5H', () => {
  let dmCookies: string;
  let playerCookies: string;
  let observerCookies: string;
  let campaignId: string;
  let sceneId: string;
  let scenesUrl: string;

  beforeAll(cleanup);

  beforeEach(async () => {
    dmCookies = await createUser('Scenes_DM', 'dm@scenes-test.com');
    playerCookies = await createUser('Scenes_Player', 'player@scenes-test.com');
    observerCookies = await createUser('Scenes_Observer', 'observer@scenes-test.com');

    const res = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Scenes Test Campaign' });
    campaignId = (res.body as { data: { id: string } }).data.id;

    // Create the active scene before inviting — the invite flow would otherwise
    // auto-create a "Default Scene" as the campaign's single active scene
    const scene = await prisma.scene.create({
      data: { campaignId, name: 'Scene A', isActive: true, sortOrder: 0 },
    });
    sceneId = scene.id;
    scenesUrl = `/api/campaigns/${campaignId}/scenes`;

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'player@scenes-test.com', role: 'player' });
    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'observer@scenes-test.com', role: 'observer' });
  });

  afterEach(cleanup);

  async function createSceneRow(name: string, sortOrder: number): Promise<string> {
    const scene = await prisma.scene.create({ data: { campaignId, name, sortOrder } });
    return scene.id;
  }

  async function createOtherCampaignScene(): Promise<string> {
    const other = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Other Scenes Campaign' });
    const scene = await prisma.scene.create({
      data: { campaignId: (other.body as { data: { id: string } }).data.id, name: 'Other' },
    });
    return scene.id;
  }

  describe('RBAC', () => {
    it('rejects players and observers on every route', async () => {
      for (const cookies of [playerCookies, observerCookies]) {
        const results = await Promise.all([
          request(app).get(scenesUrl).set('Cookie', cookies),
          request(app).post(scenesUrl).set('Cookie', cookies).send({ name: 'Nope' }),
          request(app).patch(`${scenesUrl}/${sceneId}`).set('Cookie', cookies).send({ name: 'N' }),
          request(app).delete(`${scenesUrl}/${sceneId}`).set('Cookie', cookies),
          request(app).post(`${scenesUrl}/${sceneId}/duplicate`).set('Cookie', cookies),
          request(app).put(`${scenesUrl}/order`).set('Cookie', cookies).send({ sceneIds: [sceneId] }),
          request(app).put(`${scenesUrl}/${sceneId}/thumbnail`).set('Cookie', cookies),
        ]);
        for (const res of results) expect(res.status).toBe(403);
      }
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get(scenesUrl);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /scenes', () => {
    it('returns scenes ordered by sortOrder', async () => {
      await createSceneRow('Scene C', 2);
      await createSceneRow('Scene B', 1);

      const res = await request(app).get(scenesUrl).set('Cookie', dmCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.map((s: { name: string }) => s.name)).toEqual([
        'Scene A',
        'Scene B',
        'Scene C',
      ]);
      expect(res.body.data[0]).toMatchObject({
        id: sceneId,
        campaignId,
        isActive: true,
        sortOrder: 0,
        thumbnailUrl: null,
      });
    });
  });

  describe('POST /scenes', () => {
    it('creates a scene appended to the end of the order', async () => {
      const res = await request(app)
        .post(scenesUrl)
        .set('Cookie', dmCookies)
        .send({ name: 'Scene B', width: 1024, height: 512, cellSize: 50 });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'Scene B',
        width: 1024,
        height: 512,
        cellSize: 50,
        isActive: false,
        sortOrder: 1,
      });
    });

    it('rejects an empty name and out-of-bounds dimensions', async () => {
      const bad = [
        { name: '' },
        { name: 'x'.repeat(SCENE_NAME_MAX_LENGTH + 1) },
        { name: 'Ok', width: 1 },
        { name: 'Ok', cellSize: 10_000 },
      ];
      for (const body of bad) {
        const res = await request(app).post(scenesUrl).set('Cookie', dmCookies).send(body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('PATCH /scenes/:sceneId', () => {
    it('renames a scene and updates dimensions', async () => {
      const res = await request(app)
        .patch(`${scenesUrl}/${sceneId}`)
        .set('Cookie', dmCookies)
        .send({ name: 'Renamed', width: 4096 });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: sceneId, name: 'Renamed', width: 4096 });
    });

    it('rejects an empty payload', async () => {
      const res = await request(app)
        .patch(`${scenesUrl}/${sceneId}`)
        .set('Cookie', dmCookies)
        .send({});
      expect(res.status).toBe(400);
    });

    it('rejects a scene from another campaign', async () => {
      const foreignSceneId = await createOtherCampaignScene();
      const res = await request(app)
        .patch(`${scenesUrl}/${foreignSceneId}`)
        .set('Cookie', dmCookies)
        .send({ name: 'Hijack' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SCENE_NOT_FOUND');
    });
  });

  describe('DELETE /scenes/:sceneId', () => {
    it('rejects deleting the active scene', async () => {
      await createSceneRow('Scene B', 1);
      const res = await request(app).delete(`${scenesUrl}/${sceneId}`).set('Cookie', dmCookies);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SCENE_ACTIVE');
    });

    it('rejects deleting the last remaining scene', async () => {
      await prisma.scene.update({ where: { id: sceneId }, data: { isActive: false } });
      const res = await request(app).delete(`${scenesUrl}/${sceneId}`).set('Cookie', dmCookies);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LAST_SCENE');
    });

    it('deletes an inactive scene', async () => {
      const otherId = await createSceneRow('Scene B', 1);
      const res = await request(app).delete(`${scenesUrl}/${otherId}`).set('Cookie', dmCookies);
      expect(res.status).toBe(204);
      expect(await prisma.scene.findUnique({ where: { id: otherId } })).toBeNull();
    });

    it('rejects a scene from another campaign', async () => {
      const foreignSceneId = await createOtherCampaignScene();
      const res = await request(app)
        .delete(`${scenesUrl}/${foreignSceneId}`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /scenes/:sceneId/duplicate', () => {
    it('deep-copies authored content and excludes session data', async () => {
      const dm = await prisma.user.findUniqueOrThrow({ where: { username: 'Scenes_DM' } });
      await prisma.scene.update({
        where: { id: sceneId },
        data: { fogConfig: { enabled: true }, weatherPreset: 'rain' },
      });
      const asset = await prisma.tileAsset.create({
        data: {
          campaignId,
          filename: 'floor.png',
          url: '/uploads/assets/floor.png',
          thumbnailUrl: '/uploads/thumbnails/thumb_floor.png',
          width: 64,
          height: 64,
        },
      });
      await prisma.tilePlacement.create({
        data: {
          sceneId,
          campaignId,
          assetId: asset.id,
          x: 10,
          y: 20,
          width: 64,
          height: 64,
          rotation: 90,
          zIndex: 3,
          category: 'background',
        },
      });
      await prisma.wallSegment.create({
        data: { sceneId, campaignId, x1: 0, y1: 0, x2: 128, y2: 0, isDoor: true, isOpen: true },
      });
      await prisma.lightSource.create({
        data: {
          sceneId,
          campaignId,
          x: 50,
          y: 60,
          radius: 8,
          color: '#ff9a3c',
          intensity: 0.8,
          falloff: 0.5,
          emitterType: 'torch',
          animationMode: 'flicker',
          animationSeed: 42,
        },
      });
      // Session data that must NOT be copied
      await prisma.token.create({
        data: { sceneId, campaignId, name: 'Hero', type: 'player', x: 1, y: 1 },
      });
      await prisma.fogRegion.create({
        data: { sceneId, campaignId, createdByUserId: dm.id, vertices: [{ x: 0, y: 0 }] },
      });
      await prisma.fogExploration.create({
        data: { sceneId, campaignId, cellKey: '0:0', x: 0, y: 0, radius: 100 },
      });

      const res = await request(app)
        .post(`${scenesUrl}/${sceneId}/duplicate`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(201);
      const copy = res.body.data as {
        id: string;
        name: string;
        isActive: boolean;
        sortOrder: number;
        weatherPreset: string;
      };
      expect(copy).toMatchObject({
        name: 'Scene A (copy)',
        isActive: false,
        sortOrder: 1,
        weatherPreset: 'rain',
      });

      const [copyRow, placements, walls, lights, tokens, fogRegions, fogExploration] =
        await Promise.all([
          prisma.scene.findUniqueOrThrow({ where: { id: copy.id } }),
          prisma.tilePlacement.findMany({ where: { sceneId: copy.id } }),
          prisma.wallSegment.findMany({ where: { sceneId: copy.id } }),
          prisma.lightSource.findMany({ where: { sceneId: copy.id } }),
          prisma.token.findMany({ where: { sceneId: copy.id } }),
          prisma.fogRegion.findMany({ where: { sceneId: copy.id } }),
          prisma.fogExploration.findMany({ where: { sceneId: copy.id } }),
        ]);

      expect(copyRow.fogConfig).toEqual({ enabled: true });
      expect(placements).toHaveLength(1);
      expect(placements[0]).toMatchObject({
        assetId: asset.id,
        x: 10,
        y: 20,
        rotation: 90,
        zIndex: 3,
        category: 'background',
      });
      expect(walls).toHaveLength(1);
      expect(walls[0]).toMatchObject({ x1: 0, x2: 128, isDoor: true, isOpen: true });
      expect(lights).toHaveLength(1);
      expect(lights[0]).toMatchObject({ emitterType: 'torch', animationSeed: 42 });
      // New IDs, not shared rows
      expect(placements[0].sceneId).toBe(copy.id);
      expect(tokens).toHaveLength(0);
      expect(fogRegions).toHaveLength(0);
      expect(fogExploration).toHaveLength(0);
    });

    it('rejects a scene from another campaign', async () => {
      const foreignSceneId = await createOtherCampaignScene();
      const res = await request(app)
        .post(`${scenesUrl}/${foreignSceneId}/duplicate`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /scenes/order', () => {
    it('reorders scenes in the given order', async () => {
      const bId = await createSceneRow('Scene B', 1);
      const cId = await createSceneRow('Scene C', 2);

      const res = await request(app)
        .put(`${scenesUrl}/order`)
        .set('Cookie', dmCookies)
        .send({ sceneIds: [cId, sceneId, bId] });

      expect(res.status).toBe(200);
      expect(res.body.data.map((s: { id: string }) => s.id)).toEqual([cId, sceneId, bId]);
    });

    it('rejects IDs from other campaigns', async () => {
      const foreignSceneId = await createOtherCampaignScene();
      const res = await request(app)
        .put(`${scenesUrl}/order`)
        .set('Cookie', dmCookies)
        .send({ sceneIds: [foreignSceneId] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ORDER');
      // Original order untouched
      const scene = await prisma.scene.findUniqueOrThrow({ where: { id: sceneId } });
      expect(scene.sortOrder).toBe(0);
    });

    it('rejects an incomplete scene list', async () => {
      await createSceneRow('Scene B', 1);
      const res = await request(app)
        .put(`${scenesUrl}/order`)
        .set('Cookie', dmCookies)
        .send({ sceneIds: [sceneId] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ORDER');
    });

    it('rejects duplicate IDs', async () => {
      const res = await request(app)
        .put(`${scenesUrl}/order`)
        .set('Cookie', dmCookies)
        .send({ sceneIds: [sceneId, sceneId] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /scenes/:sceneId/thumbnail', () => {
    async function makePng(width = 800, height = 600): Promise<Buffer> {
      return sharp({
        create: { width, height, channels: 3, background: { r: 51, g: 102, b: 153 } },
      })
        .png()
        .toBuffer();
    }

    it('re-encodes the upload to WebP at the fixed max width', async () => {
      const res = await request(app)
        .put(`${scenesUrl}/${sceneId}/thumbnail`)
        .set('Cookie', dmCookies)
        .attach('file', await makePng(), 'thumb.png');

      expect(res.status).toBe(200);
      const thumbnailUrl = res.body.data.thumbnailUrl as string;
      expect(thumbnailUrl).toMatch(/^\/uploads\/thumbnails\/scene-thumb_.+\.webp$/);

      const filePath = join(process.cwd(), thumbnailUrl.replace(/^\//, ''));
      const meta = await sharp(filePath).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(SCENE_THUMBNAIL_WIDTH);
    });

    it('replaces the previous thumbnail file', async () => {
      const first = await request(app)
        .put(`${scenesUrl}/${sceneId}/thumbnail`)
        .set('Cookie', dmCookies)
        .attach('file', await makePng(), 'thumb.png');
      const firstUrl = first.body.data.thumbnailUrl as string;

      const second = await request(app)
        .put(`${scenesUrl}/${sceneId}/thumbnail`)
        .set('Cookie', dmCookies)
        .attach('file', await makePng(400, 300), 'thumb2.png');
      const secondUrl = second.body.data.thumbnailUrl as string;

      expect(secondUrl).not.toBe(firstUrl);
      const firstPath = join(process.cwd(), firstUrl.replace(/^\//, ''));
      await expect(access(firstPath)).rejects.toThrow();
    });

    it('rejects disallowed MIME types', async () => {
      const jpeg = await sharp({
        create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .jpeg()
        .toBuffer();
      const res = await request(app)
        .put(`${scenesUrl}/${sceneId}/thumbnail`)
        .set('Cookie', dmCookies)
        .attach('file', jpeg, 'sneaky.jpg');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_UPLOAD');
    });

    it('rejects a body that is not a decodable image', async () => {
      const res = await request(app)
        .put(`${scenesUrl}/${sceneId}/thumbnail`)
        .set('Cookie', dmCookies)
        .attach('file', Buffer.from('not an image'), { filename: 'x.png', contentType: 'image/png' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_IMAGE');
    });

    it('rejects a missing file', async () => {
      const res = await request(app)
        .put(`${scenesUrl}/${sceneId}/thumbnail`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_FILE');
    });

    it('rejects a scene from another campaign', async () => {
      const foreignSceneId = await createOtherCampaignScene();
      const res = await request(app)
        .put(`${scenesUrl}/${foreignSceneId}/thumbnail`)
        .set('Cookie', dmCookies)
        .attach('file', await makePng(10, 10), 'thumb.png');
      expect(res.status).toBe(404);
    });
  });
});
