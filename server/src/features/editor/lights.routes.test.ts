// Light source + scene atmosphere routes — Phase 5G
import request from 'supertest';
import type { MockInstance } from 'vitest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { EDITOR_EVENTS, LIGHT_PRESETS, MAX_LIGHTS_PER_SCENE } from '@vtt/shared';

import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { getIo } from '../../shared/socket/io-instance.js';
import { hashPassword } from '../../shared/utils/password.js';

const emitSpy = vi.fn();
let toSpy: MockInstance;

const TEST_USERNAMES = ['Lights_DM', 'Lights_Player', 'Lights_Observer'];
const PASSWORD = 'password123';
const TORCH = { emitterType: 'torch', x: 96, y: 160 } as const;

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

describe('Light Routes — Phase 5G', () => {
  let dmCookies: string;
  let playerCookies: string;
  let observerCookies: string;
  let campaignId: string;
  let sceneId: string;
  let lightsUrl: string;
  let atmosphereUrl: string;

  beforeAll(cleanup);

  beforeEach(async () => {
    dmCookies = await createUser('Lights_DM', 'dm@lights-test.com');
    playerCookies = await createUser('Lights_Player', 'player@lights-test.com');
    observerCookies = await createUser('Lights_Observer', 'observer@lights-test.com');

    const res = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Lights Test Campaign' });
    campaignId = (res.body as { data: { id: string } }).data.id;

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'player@lights-test.com', role: 'player' });
    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: 'observer@lights-test.com', role: 'observer' });

    const scene = await prisma.scene.create({ data: { campaignId, name: 'Lights Scene' } });
    sceneId = scene.id;
    lightsUrl = `/api/campaigns/${campaignId}/scenes/${sceneId}/lights`;
    atmosphereUrl = `/api/campaigns/${campaignId}/scenes/${sceneId}/atmosphere`;

    emitSpy.mockClear();
    toSpy = vi.spyOn(getIo()!, 'to').mockReturnValue({ emit: emitSpy } as never);
  });

  afterEach(async () => {
    toSpy.mockRestore();
    await cleanup();
  });

  async function createLight(body: object = TORCH): Promise<{ id: string }> {
    const res = await request(app).post(lightsUrl).set('Cookie', dmCookies).send(body);
    return (res.body as { data: { id: string } }).data;
  }

  async function createOtherCampaignScene(): Promise<string> {
    const other = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Other Lights Campaign' });
    const scene = await prisma.scene.create({
      data: { campaignId: (other.body as { data: { id: string } }).data.id, name: 'Other' },
    });
    return scene.id;
  }

  describe('POST /lights', () => {
    it('fills omitted fields from the emitter preset, assigns a seed, and broadcasts', async () => {
      const res = await request(app).post(lightsUrl).set('Cookie', dmCookies).send(TORCH);

      const { label: _label, tone: _tone, ...torchDefaults } = LIGHT_PRESETS.torch;
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ ...TORCH, ...torchDefaults, sceneId, campaignId });
      expect(Number.isInteger(res.body.data.animationSeed)).toBe(true);
      expect(res.body.data.alwaysVisible).toBe(false);
      expect(toSpy).toHaveBeenCalledWith(`campaign:${campaignId}`);
      expect(emitSpy).toHaveBeenCalledWith(EDITOR_EVENTS.LIGHTS_UPDATED, { campaignId, sceneId });
    });

    it('lets explicit fields override the preset', async () => {
      const res = await request(app)
        .post(lightsUrl)
        .set('Cookie', dmCookies)
        .send({ ...TORCH, color: '#00ff00', animationMode: 'none' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        color: '#00ff00',
        animationMode: 'none',
        radius: LIGHT_PRESETS.torch.radius,
      });
    });

    it('rejects invalid payloads without broadcasting', async () => {
      const cases = [
        { ...TORCH, emitterType: 'sun' },
        { ...TORCH, color: 'orange' },
        { ...TORCH, intensity: 1.5 },
        { ...TORCH, radius: 0 },
        { ...TORCH, animationSeed: 42 },
        { ...TORCH, sceneId: 'other-scene' },
        { ...TORCH, campaignId: 'other-campaign' },
        { emitterType: 'torch', x: 0 },
      ];
      for (const body of cases) {
        const res = await request(app).post(lightsUrl).set('Cookie', dmCookies).send(body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('returns 403 for a player and an observer', async () => {
      for (const cookies of [playerCookies, observerCookies]) {
        const res = await request(app).post(lightsUrl).set('Cookie', cookies).send(TORCH);
        expect(res.status).toBe(403);
      }
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post(lightsUrl).send(TORCH);
      expect(res.status).toBe(401);
    });

    it('returns 404 for a scene in another campaign', async () => {
      const otherSceneId = await createOtherCampaignScene();
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/scenes/${otherSceneId}/lights`)
        .set('Cookie', dmCookies)
        .send(TORCH);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SCENE_NOT_FOUND');
    });

    it('returns 409 once the per-scene limit is reached', async () => {
      await prisma.lightSource.createMany({
        data: Array.from({ length: MAX_LIGHTS_PER_SCENE }, () => ({
          ...TORCH,
          radius: 1,
          color: '#ffffff',
          intensity: 1,
          falloff: 0,
          animationSeed: 1,
          sceneId,
          campaignId,
        })),
      });
      const res = await request(app).post(lightsUrl).set('Cookie', dmCookies).send(TORCH);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LIGHT_LIMIT_REACHED');
    });
  });

  describe('GET /lights', () => {
    it('lists lights in creation order for the DM', async () => {
      const first = await createLight();
      const second = await createLight({ emitterType: 'beacon', x: 0, y: 0 });

      const res = await request(app).get(lightsUrl).set('Cookie', dmCookies);
      expect(res.status).toBe(200);
      expect((res.body.data as { id: string }[]).map((l) => l.id)).toEqual([first.id, second.id]);
    });

    it('returns 403 for a player', async () => {
      const res = await request(app).get(lightsUrl).set('Cookie', playerCookies);
      expect(res.status).toBe(403);
    });

    it('returns 404 for a scene in another campaign', async () => {
      const otherSceneId = await createOtherCampaignScene();
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/scenes/${otherSceneId}/lights`)
        .set('Cookie', dmCookies);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /lights/:lightId', () => {
    it('updates properties, keeps the seed, and broadcasts', async () => {
      const light = await createLight();
      const before = await prisma.lightSource.findUniqueOrThrow({ where: { id: light.id } });
      emitSpy.mockClear();

      const res = await request(app)
        .patch(`${lightsUrl}/${light.id}`)
        .set('Cookie', dmCookies)
        .send({ intensity: 0.25, falloff: 1, animationMode: 'pulse', x: 10, alwaysVisible: true });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        intensity: 0.25,
        falloff: 1,
        animationMode: 'pulse',
        x: 10,
        alwaysVisible: true,
        animationSeed: before.animationSeed,
      });
      expect(emitSpy).toHaveBeenCalledWith(EDITOR_EVENTS.LIGHTS_UPDATED, { campaignId, sceneId });
    });

    it('rejects empty, out-of-range, and seed payloads', async () => {
      const light = await createLight();
      for (const body of [{}, { falloff: -0.1 }, { animationSeed: 5 }, { alwaysVisible: 'yes' }]) {
        const res = await request(app)
          .patch(`${lightsUrl}/${light.id}`)
          .set('Cookie', dmCookies)
          .send(body);
        expect(res.status).toBe(400);
      }
    });

    it('returns 404 for an unknown light or one on another scene', async () => {
      const light = await createLight();
      const otherScene = await prisma.scene.create({ data: { campaignId, name: 'Other' } });

      const unknown = await request(app)
        .patch(`${lightsUrl}/does-not-exist`)
        .set('Cookie', dmCookies)
        .send({ intensity: 0.5 });
      expect(unknown.status).toBe(404);

      const crossScene = await request(app)
        .patch(`/api/campaigns/${campaignId}/scenes/${otherScene.id}/lights/${light.id}`)
        .set('Cookie', dmCookies)
        .send({ intensity: 0.5 });
      expect(crossScene.status).toBe(404);
    });

    it('returns 404 when addressing a light through another campaign the DM owns', async () => {
      const light = await createLight();
      const other = await request(app)
        .post('/api/campaigns')
        .set('Cookie', dmCookies)
        .send({ name: 'Other Lights Campaign' });
      const otherId = (other.body as { data: { id: string } }).data.id;
      const url = `/api/campaigns/${otherId}/scenes/${sceneId}/lights/${light.id}`;

      const patch = await request(app).patch(url).set('Cookie', dmCookies).send({ x: 1 });
      const del = await request(app).delete(url).set('Cookie', dmCookies);

      expect(patch.status).toBe(404);
      expect(del.status).toBe(404);
      expect(await prisma.lightSource.count({ where: { id: light.id } })).toBe(1);
    });

    it('returns 403 for a player', async () => {
      const light = await createLight();
      const res = await request(app)
        .patch(`${lightsUrl}/${light.id}`)
        .set('Cookie', playerCookies)
        .send({ intensity: 0.5 });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /lights/:lightId', () => {
    it('deletes a light and broadcasts', async () => {
      const light = await createLight();
      emitSpy.mockClear();

      const res = await request(app).delete(`${lightsUrl}/${light.id}`).set('Cookie', dmCookies);
      expect(res.status).toBe(204);
      expect(await prisma.lightSource.count({ where: { sceneId } })).toBe(0);
      expect(emitSpy).toHaveBeenCalledWith(EDITOR_EVENTS.LIGHTS_UPDATED, { campaignId, sceneId });
    });

    it('returns 404 for an unknown light', async () => {
      const res = await request(app).delete(`${lightsUrl}/nope`).set('Cookie', dmCookies);
      expect(res.status).toBe(404);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('returns 403 for an observer', async () => {
      const light = await createLight();
      const res = await request(app)
        .delete(`${lightsUrl}/${light.id}`)
        .set('Cookie', observerCookies);
      expect(res.status).toBe(403);
    });
  });

  describe('scene atmosphere', () => {
    it('defaults to no weather and persists an update', async () => {
      const initial = await request(app).get(atmosphereUrl).set('Cookie', dmCookies);
      expect(initial.status).toBe(200);
      expect(initial.body.data).toEqual({ weatherPreset: 'none' });

      const patched = await request(app)
        .patch(atmosphereUrl)
        .set('Cookie', dmCookies)
        .send({ weatherPreset: 'rain' });
      expect(patched.status).toBe(200);
      expect(patched.body.data).toEqual({ weatherPreset: 'rain' });

      const scene = await prisma.scene.findUniqueOrThrow({ where: { id: sceneId } });
      expect(scene.weatherPreset).toBe('rain');
    });

    it('rejects unknown presets', async () => {
      const res = await request(app)
        .patch(atmosphereUrl)
        .set('Cookie', dmCookies)
        .send({ weatherPreset: 'tornado' });
      expect(res.status).toBe(400);
    });

    it('returns 403 for a player', async () => {
      const res = await request(app)
        .patch(atmosphereUrl)
        .set('Cookie', playerCookies)
        .send({ weatherPreset: 'snow' });
      expect(res.status).toBe(403);
    });

    it('hides the preset from players and observers', async () => {
      for (const cookies of [playerCookies, observerCookies]) {
        const res = await request(app).get(atmosphereUrl).set('Cookie', cookies);
        expect(res.status).toBe(403);
      }
    });

    it('returns 404 for a scene in another campaign', async () => {
      const otherSceneId = await createOtherCampaignScene();
      const url = `/api/campaigns/${campaignId}/scenes/${otherSceneId}/atmosphere`;
      expect((await request(app).get(url).set('Cookie', dmCookies)).status).toBe(404);
      expect(
        (await request(app).patch(url).set('Cookie', dmCookies).send({ weatherPreset: 'haze' }))
          .status,
      ).toBe(404);
    });
  });
});
