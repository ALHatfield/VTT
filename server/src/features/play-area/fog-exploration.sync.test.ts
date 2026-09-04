import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FogExplorationSyncPayload, FogMaskConfig } from '@vtt/shared';
import { DEFAULT_FOG_MASK_CONFIG, FOG_CONFIG_EVENTS } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';
import { computeTokenVisionRegions, syncSceneExploration } from './vision.service.js';

const TEST_EMAIL_DM = 'fog-explore-dm@test.local';
const TEST_EMAIL_PLAYER = 'fog-explore-player@test.local';

let dmId: string;
let playerId: string;
let campaignId: string;
let sceneId: string;
let emitted: { role: string; event: string; payload: unknown }[];

function makeIo(roles: string[] = ['dm', 'player']): unknown {
  const sockets = roles.map((role) => ({
    data: { campaignRole: role },
    emit: (event: string, payload: unknown): void => {
      emitted.push({ role, event, payload });
    },
  }));

  return { in: () => ({ fetchSockets: () => Promise.resolve(sockets) }) };
}

async function setFogConfig(overrides: Partial<FogMaskConfig>): Promise<void> {
  await prisma.scene.update({
    where: { id: sceneId },
    data: { fogConfig: { ...DEFAULT_FOG_MASK_CONFIG, ...overrides } },
  });
}

async function runSync(roles?: string[]): Promise<void> {
  const reveals = await computeTokenVisionRegions(sceneId, campaignId);
  await syncSceneExploration(makeIo(roles) as never, campaignId, sceneId, reveals);
}

describe('syncSceneExploration (Phase PM2)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL_DM, TEST_EMAIL_PLAYER] } } });
  });

  beforeEach(async () => {
    emitted = [];
    vi.restoreAllMocks();

    const passwordHash = await hashPassword('password123');
    const dm = await prisma.user.create({
      data: { username: 'FogExploreDM', email: TEST_EMAIL_DM, passwordHash },
    });
    const player = await prisma.user.create({
      data: { username: 'FogExplorePlayer', email: TEST_EMAIL_PLAYER, passwordHash },
    });
    dmId = dm.id;
    playerId = player.id;

    const campaign = await prisma.campaign.create({
      data: {
        name: 'Fog Exploration Campaign',
        members: {
          create: [
            { userId: dmId, role: 'dm' },
            { userId: playerId, role: 'player' },
          ],
        },
      },
    });
    campaignId = campaign.id;

    const scene = await prisma.scene.create({
      data: { campaignId, name: 'Fog Exploration Scene', isActive: true, cellSize: 64 },
    });
    sceneId = scene.id;
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.user.deleteMany({ where: { id: { in: [dmId, playerId] } } });
  });

  it('records nothing while the scene uses the legacy renderer', async () => {
    await setFogConfig({ fogMode: 'legacy', explorationMode: 'persistent' });
    await prisma.token.create({
      data: {
        sceneId,
        campaignId,
        name: 'Hero',
        type: 'player',
        x: 2,
        y: 3,
        visionRadius: 6,
        ownerId: playerId,
      },
    });

    await runSync();

    expect(await prisma.fogExploration.count({ where: { sceneId } })).toBe(0);
    expect(emitted).toHaveLength(0);
  });

  it('records nothing while exploration is off', async () => {
    await setFogConfig({ fogMode: 'pm2', explorationMode: 'off' });
    await prisma.token.create({
      data: {
        sceneId,
        campaignId,
        name: 'Hero',
        type: 'player',
        x: 2,
        y: 3,
        visionRadius: 6,
        ownerId: playerId,
      },
    });

    await runSync();

    expect(await prisma.fogExploration.count({ where: { sceneId } })).toBe(0);
  });

  it('persists explored areas and broadcasts only the new delta', async () => {
    await setFogConfig({ fogMode: 'pm2', explorationMode: 'persistent' });
    await prisma.token.create({
      data: {
        sceneId,
        campaignId,
        name: 'Hero',
        type: 'player',
        x: 2,
        y: 3,
        visionRadius: 6,
        ownerId: playerId,
      },
    });

    await runSync();

    const rows = await prisma.fogExploration.findMany({ where: { sceneId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cellKey: '2:3', x: 160, y: 224, radius: 384 });

    expect(emitted).toHaveLength(2);
    expect(emitted[0].event).toBe(FOG_CONFIG_EVENTS.FOG_EXPLORATION_SYNC);
    const payload = emitted[0].payload as FogExplorationSyncPayload;
    expect(payload.mode).toBe('append');
    expect(payload.stamps).toHaveLength(1);
  });

  it('never delivers exploration to observer sockets', async () => {
    await setFogConfig({ fogMode: 'pm2', explorationMode: 'persistent' });
    await prisma.token.create({
      data: {
        sceneId,
        campaignId,
        name: 'Hero',
        type: 'player',
        x: 2,
        y: 3,
        visionRadius: 6,
        ownerId: playerId,
      },
    });

    await runSync(['dm', 'player', 'observer']);

    expect(emitted.map((e) => e.role)).toEqual(['dm', 'player']);
  });

  it('does not re-emit when a stationary token adds no new area', async () => {
    await setFogConfig({ fogMode: 'pm2', explorationMode: 'persistent' });
    await prisma.token.create({
      data: {
        sceneId,
        campaignId,
        name: 'Hero',
        type: 'player',
        x: 2,
        y: 3,
        visionRadius: 6,
        ownerId: playerId,
      },
    });

    await runSync();
    emitted = [];
    await runSync();

    expect(await prisma.fogExploration.count({ where: { sceneId } })).toBe(1);
    expect(emitted).toHaveLength(0);
  });

  it('excludes enemy NPC vision so hidden monsters cannot uncover the map', async () => {
    await setFogConfig({ fogMode: 'pm2', explorationMode: 'persistent' });
    await prisma.token.create({
      data: {
        sceneId,
        campaignId,
        name: 'Goblin',
        type: 'npc',
        npcSubtype: 'enemy',
        x: 20,
        y: 20,
        visionRadius: 6,
        ownerId: null,
      },
    });
    await prisma.token.create({
      data: {
        sceneId,
        campaignId,
        name: 'Guide',
        type: 'npc',
        npcSubtype: 'ally',
        x: 5,
        y: 5,
        visionRadius: 6,
        ownerId: null,
      },
    });

    await runSync();

    const rows = await prisma.fogExploration.findMany({ where: { sceneId } });
    expect(rows.map((r) => r.cellKey)).toEqual(['5:5']);
  });
});
