// Wall segment routes — Phase 5F
import request from 'supertest';
import type { MockInstance } from 'vitest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { EDITOR_EVENTS, MAX_WALLS_PER_SCENE } from '@vtt/shared';

import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { getIo } from '../../shared/socket/io-instance.js';
import { hashPassword } from '../../shared/utils/password.js';

const emitSpy = vi.fn();
let toSpy: MockInstance;

const TEST_USERNAMES = ['Walls_DM', 'Walls_Player', 'Walls_Observer'];
const PASSWORD = 'password123';
const SEGMENT = { x1: 0, y1: 0, x2: 128, y2: 0 };

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

describe('Wall Routes — Phase 5F', () => {
  let dmCookies: string;
  let playerCookies: string;
  let observerCookies: string;
  let campaignId: string;
  let sceneId: string;
  let wallsUrl: string;

  beforeAll(cleanup);

  beforeEach(async () => {
    dmCookies = await createUser('Walls_DM', 'dm@walls-test.com');
    playerCookies = await createUser('Walls_Player', 'player@walls-test.com');
    observerCookies = await createUser('Walls_Observer', 'observer@walls-test.com');

    const res = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Walls Test Campaign' });
    campaignId = (res.body as { data: { id: string } }).data.id;

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'player@walls-test.com', role: 'player' });
    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'observer@walls-test.com', role: 'observer' });

    const scene = await prisma.scene.create({ data: { campaignId, name: 'Walls Scene' } });
    sceneId = scene.id;
    wallsUrl = `/api/campaigns/${campaignId}/scenes/${sceneId}/walls`;

    emitSpy.mockClear();
    toSpy = vi.spyOn(getIo()!, 'to').mockReturnValue({ emit: emitSpy } as never);
  });

  afterEach(async () => {
    toSpy.mockRestore();
    await cleanup();
  });

  async function createWall(body: object = SEGMENT): Promise<{ id: string }> {
    const res = await request(app).post(wallsUrl).set('Cookie', dmCookies).send(body);
    return (res.body as { data: { id: string } }).data;
  }

  describe('POST /walls', () => {
    it('creates a wall with default flags and broadcasts', async () => {
      const res = await request(app).post(wallsUrl).set('Cookie', dmCookies).send(SEGMENT);

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        ...SEGMENT,
        sceneId,
        campaignId,
        blocksLight: true,
        blocksMovement: true,
        isDoor: false,
        isOpen: false,
      });
      expect(toSpy).toHaveBeenCalledWith(`campaign:${campaignId}`);
      expect(emitSpy).toHaveBeenCalledWith(EDITOR_EVENTS.WALLS_UPDATED, { campaignId, sceneId });
    });

    it('rejects zero-length segments', async () => {
      const res = await request(app)
        .post(wallsUrl)
        .set('Cookie', dmCookies)
        .send({ x1: 10, y1: 10, x2: 10, y2: 10 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('rejects an open non-door wall', async () => {
      const res = await request(app)
        .post(wallsUrl)
        .set('Cookie', dmCookies)
        .send({ ...SEGMENT, isOpen: true });
      expect(res.status).toBe(400);
    });

    it('returns 403 for a player', async () => {
      const res = await request(app).post(wallsUrl).set('Cookie', playerCookies).send(SEGMENT);
      expect(res.status).toBe(403);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post(wallsUrl).send(SEGMENT);
      expect(res.status).toBe(401);
    });

    it('returns 404 for a scene in another campaign', async () => {
      const other = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'Other Walls Campaign' });
      const otherScene = await prisma.scene.create({
        data: { campaignId: (other.body as { data: { id: string } }).data.id, name: 'Other' },
      });

      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${otherScene.id}/walls`)
        .set('Cookie', dmCookies)
        .send(SEGMENT);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SCENE_NOT_FOUND');
    });

    it('returns 409 when the scene wall limit is reached', async () => {
      await prisma.wallSegment.createMany({
        data: Array.from({ length: MAX_WALLS_PER_SCENE }, (_, i) => ({
          campaignId,
          sceneId,
          x1: i,
          y1: 0,
          x2: i,
          y2: 64,
        })),
      });

      const res = await request(app).post(wallsUrl).set('Cookie', dmCookies).send(SEGMENT);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('WALL_LIMIT_REACHED');
    });
  });

  describe('GET /walls', () => {
    it('lists walls on the scene for the DM', async () => {
      await createWall();
      await createWall({ x1: 0, y1: 0, x2: 0, y2: 64, isDoor: true });

      const res = await request(app).get(wallsUrl).set('Cookie', dmCookies);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.filter((w: { isDoor: boolean }) => w.isDoor)).toHaveLength(1);
    });

    it('returns 403 for a player', async () => {
      const res = await request(app).get(wallsUrl).set('Cookie', playerCookies);
      expect(res.status).toBe(403);
    });

    it('returns 403 for an observer', async () => {
      const res = await request(app).get(wallsUrl).set('Cookie', observerCookies);
      expect(res.status).toBe(403);
    });

    it('returns 404 for a scene in another campaign', async () => {
      const other = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'Other Walls Campaign' });
      const otherScene = await prisma.scene.create({
        data: { campaignId: (other.body as { data: { id: string } }).data.id, name: 'Other' },
      });

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${otherScene.id}/walls`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(404);
    });
  });

  describe('cross-campaign scoping', () => {
    let foreignWallId: string;

    beforeEach(async () => {
      const other = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'Foreign Walls Campaign' });
      const otherCampaignId = (other.body as { data: { id: string } }).data.id;
      const otherScene = await prisma.scene.create({
        data: { campaignId: otherCampaignId, name: 'Foreign' },
      });
      const wall = await prisma.wallSegment.create({
        data: { campaignId: otherCampaignId, sceneId: otherScene.id, ...SEGMENT },
      });
      foreignWallId = wall.id;
    });

    it('cannot update a wall from another campaign through this campaign', async () => {
      const res = await request(app)
        .patch(`${wallsUrl}/${foreignWallId}`)
        .set('Cookie', dmCookies)
        .send({ isDoor: true });

      expect(res.status).toBe(404);
      const wall = await prisma.wallSegment.findUnique({ where: { id: foreignWallId } });
      expect(wall?.isDoor).toBe(false);
    });

    it('cannot delete a wall from another campaign through this campaign', async () => {
      const res = await request(app)
        .delete(`${wallsUrl}/${foreignWallId}`)
        .set('Cookie', dmCookies);

      expect(res.status).toBe(404);
      expect(await prisma.wallSegment.count({ where: { id: foreignWallId } })).toBe(1);
    });

    it('bulk delete leaves other campaigns untouched', async () => {
      await createWall();
      await request(app).delete(wallsUrl).set('Cookie', dmCookies);
      expect(await prisma.wallSegment.count({ where: { id: foreignWallId } })).toBe(1);
    });
  });

  describe('PATCH /walls/:wallId', () => {
    it('moves an endpoint and toggles door state', async () => {
      const wall = await createWall();
      emitSpy.mockClear();

      const res = await request(app)
        .patch(`${wallsUrl}/${wall.id}`)
        .set('Cookie', dmCookies)
        .send({ x2: 192, isDoor: true, isOpen: true });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ x2: 192, isDoor: true, isOpen: true });
      expect(emitSpy).toHaveBeenCalledWith(EDITOR_EVENTS.WALLS_UPDATED, { campaignId, sceneId });
    });

    it('closes the segment when isDoor is cleared', async () => {
      const wall = await createWall({ ...SEGMENT, isDoor: true, isOpen: true });

      const res = await request(app)
        .patch(`${wallsUrl}/${wall.id}`)
        .set('Cookie', dmCookies)
        .send({ isDoor: false });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ isDoor: false, isOpen: false });
    });

    it('rejects an update that collapses the segment to a point', async () => {
      const wall = await createWall();

      const res = await request(app)
        .patch(`${wallsUrl}/${wall.id}`)
        .set('Cookie', dmCookies)
        .send({ x2: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DEGENERATE_WALL');
    });

    it('rejects opening a wall that is not a door', async () => {
      const wall = await createWall();

      const res = await request(app)
        .patch(`${wallsUrl}/${wall.id}`)
        .set('Cookie', dmCookies)
        .send({ isOpen: true });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DOOR_STATE');
    });

    it('rejects an empty payload', async () => {
      const wall = await createWall();
      const res = await request(app)
        .patch(`${wallsUrl}/${wall.id}`)
        .set('Cookie', dmCookies)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown wall', async () => {
      const res = await request(app)
        .patch(`${wallsUrl}/does-not-exist`)
        .set('Cookie', dmCookies)
        .send({ isDoor: true });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('WALL_NOT_FOUND');
    });

    it('returns 403 for a player', async () => {
      const wall = await createWall();
      const res = await request(app)
        .patch(`${wallsUrl}/${wall.id}`)
        .set('Cookie', playerCookies)
        .send({ isDoor: true });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /walls/:wallId', () => {
    it('deletes a wall and broadcasts', async () => {
      const wall = await createWall();
      emitSpy.mockClear();

      const res = await request(app).delete(`${wallsUrl}/${wall.id}`).set('Cookie', dmCookies);
      expect(res.status).toBe(204);
      expect(await prisma.wallSegment.count({ where: { sceneId } })).toBe(0);
      expect(emitSpy).toHaveBeenCalledWith(EDITOR_EVENTS.WALLS_UPDATED, { campaignId, sceneId });
    });

    it('returns 404 for an unknown wall', async () => {
      const res = await request(app).delete(`${wallsUrl}/does-not-exist`).set('Cookie', dmCookies);
      expect(res.status).toBe(404);
    });

    it('returns 403 for a player', async () => {
      const wall = await createWall();
      const res = await request(app).delete(`${wallsUrl}/${wall.id}`).set('Cookie', playerCookies);
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /walls (bulk)', () => {
    it('deletes every wall on the scene', async () => {
      await createWall();
      await createWall({ x1: 0, y1: 0, x2: 0, y2: 64 });
      emitSpy.mockClear();

      const res = await request(app).delete(wallsUrl).set('Cookie', dmCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.deletedCount).toBe(2);
      expect(emitSpy).toHaveBeenCalledTimes(1);
    });

    it('does not broadcast when nothing was deleted', async () => {
      const res = await request(app).delete(wallsUrl).set('Cookie', dmCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.deletedCount).toBe(0);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('returns 403 for a player', async () => {
      const res = await request(app).delete(wallsUrl).set('Cookie', playerCookies);
      expect(res.status).toBe(403);
    });
  });
});
