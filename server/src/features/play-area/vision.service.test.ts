import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VisionUpdatedPayload } from '@vtt/shared';
import { TOKEN_VISION_EVENTS, VISION_EVENTS } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';
import { createTemporaryLight, deleteTemporaryLight } from './temporary-lights.store.js';
import {
    computeTokenVisionRegions,
    emitVisionSync,
    isDoorVisibleToParty,
} from './vision.service.js';

/** Sockets now also receive `vision:updated` (PM3) — find the token vision sync by name. */
function visionSyncCall(emit: ReturnType<typeof vi.fn>): [string, unknown] {
  const call = emit.mock.calls.find(([event]) => event === TOKEN_VISION_EVENTS.TOKEN_VISION_SYNC);
  if (!call) throw new Error('token vision sync was not emitted');
  return call as [string, unknown];
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function createUser(username: string, email: string): Promise<string> {
  const passwordHash = await hashPassword('password123');
  const user = await prisma.user.create({ data: { username, email, passwordHash } });
  return user.id;
}

async function createCampaign(ownerId: string): Promise<string> {
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Vision Test Campaign',
      members: { create: { userId: ownerId, role: 'dm' } },
    },
  });
  return campaign.id;
}

async function createScene(campaignId: string): Promise<string> {
  const scene = await prisma.scene.create({
    data: { campaignId, name: 'Vision Test Scene', isActive: true },
  });
  return scene.id;
}

async function createToken(
  sceneId: string,
  campaignId: string,
  x: number,
  y: number,
  visionRadius: number,
  ownerId: string | null = null,
): Promise<string> {
  const token = await prisma.token.create({
    data: { sceneId, campaignId, name: 'Test', type: 'player', x, y, visionRadius, ownerId },
  });
  return token.id;
}

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

const TEST_EMAIL_DM = 'vision-dm@test.local';
const TEST_EMAIL_PLAYER = 'vision-player@test.local';

let dmId: string;
let playerId: string;
let campaignId: string;
let sceneId: string;

describe('computeTokenVisionRegions', () => {
  beforeAll(async () => {
    // Clean up any leftover data from previous test runs
    for (const email of [TEST_EMAIL_DM, TEST_EMAIL_PLAYER]) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.campaign.deleteMany({
          where: { members: { some: { userId: user.id } } },
        });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  });

  beforeEach(async () => {
    dmId = await createUser('VisionDM', TEST_EMAIL_DM);
    playerId = await createUser('VisionPlayer', TEST_EMAIL_PLAYER);
    campaignId = await createCampaign(dmId);
    sceneId = await createScene(campaignId);
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.user.deleteMany({ where: { id: { in: [dmId, playerId] } } });
  });

  it('returns an empty array when no tokens exist on the scene', async () => {
    const reveals = await computeTokenVisionRegions(sceneId, campaignId);
    expect(reveals).toEqual([]);
  });

  it('returns vision reveals for all tokens on the scene', async () => {
    const tokenId1 = await createToken(sceneId, campaignId, 3, 4, 6, null);
    const tokenId2 = await createToken(sceneId, campaignId, 10, 2, 8, playerId);

    const reveals = await computeTokenVisionRegions(sceneId, campaignId);
    expect(reveals).toHaveLength(2);

    const r1 = reveals.find((r) => r.tokenId === tokenId1);
    expect(r1).toMatchObject({ tokenId: tokenId1, x: 3, y: 4, visionRadius: 6, sceneId });

    const r2 = reveals.find((r) => r.tokenId === tokenId2);
    expect(r2).toMatchObject({ tokenId: tokenId2, x: 10, y: 2, visionRadius: 8, sceneId });
  });

  it('includes ownerId in the internal result for role-gating', async () => {
    await createToken(sceneId, campaignId, 1, 1, 6, playerId);

    const reveals = await computeTokenVisionRegions(sceneId, campaignId);
    expect(reveals[0]).toHaveProperty('ownerId', playerId);
  });

  it('only returns tokens for the given scene', async () => {
    const otherScene = await prisma.scene.create({
      data: { campaignId, name: 'Other Scene', isActive: false },
    });
    await createToken(sceneId, campaignId, 1, 1, 6, null);
    await createToken(otherScene.id, campaignId, 5, 5, 4, null);

    const reveals = await computeTokenVisionRegions(sceneId, campaignId);
    expect(reveals).toHaveLength(1);
    expect(reveals[0]?.x).toBe(1);
  });
});

describe('emitVisionSync — role-gated delivery', () => {
  beforeAll(async () => {
    for (const email of [TEST_EMAIL_DM, TEST_EMAIL_PLAYER]) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.campaign.deleteMany({
          where: { members: { some: { userId: user.id } } },
        });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  });

  beforeEach(async () => {
    dmId = await createUser('VisionDM2', TEST_EMAIL_DM);
    playerId = await createUser('VisionPlayer2', TEST_EMAIL_PLAYER);
    campaignId = await createCampaign(dmId);
    sceneId = await createScene(campaignId);
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.user.deleteMany({ where: { id: { in: [dmId, playerId] } } });
  });

  function makeMockSocket(role: string, userId: string): { data: Record<string, unknown>; emit: ReturnType<typeof vi.fn> } {
    return {
      data: { campaignRole: role, userId },
      emit: vi.fn(),
    };
  }

  it('sends all reveals to DM sockets', async () => {
    await createToken(sceneId, campaignId, 1, 1, 6, playerId);
    await createToken(sceneId, campaignId, 5, 5, 4, null);

    const dmSocket = makeMockSocket('dm', dmId);

    const mockIo = {
      in: vi.fn().mockReturnValue({
        fetchSockets: vi.fn().mockResolvedValue([dmSocket]),
      }),
    };

    await emitVisionSync(mockIo as never, campaignId, sceneId);

    expect(dmSocket.emit).toHaveBeenCalledTimes(2);
    const [event, payload] = visionSyncCall(dmSocket.emit) as [string, { reveals: unknown[] }];
    expect(event).toBe('play-area:token:vision:sync');
    expect(payload.reveals).toHaveLength(2);
    // ownerId must NOT be present in the emitted payload
    expect((payload.reveals[0] as Record<string, unknown>)).not.toHaveProperty('ownerId');
  });

  it('sends all player-owned token reveals to player sockets (shared party vision)', async () => {
    await createToken(sceneId, campaignId, 1, 1, 6, playerId);   // owned by this player
    await createToken(sceneId, campaignId, 3, 3, 4, dmId);       // owned by another player (DM user acting as player for test)
    await createToken(sceneId, campaignId, 5, 5, 4, null);       // DM-controlled, no owner

    const playerSocket = makeMockSocket('player', playerId);

    const mockIo = {
      in: vi.fn().mockReturnValue({
        fetchSockets: vi.fn().mockResolvedValue([playerSocket]),
      }),
    };

    await emitVisionSync(mockIo as never, campaignId, sceneId);

    const [, payload] = visionSyncCall(playerSocket.emit) as [string, { reveals: { tokenId: string; x: number; y: number }[] }];
    // Players see both player-owned tokens — shared party vision
    expect(payload.reveals).toHaveLength(2);
    // The unowned (DM-controlled) token is excluded
    const positions = payload.reveals.map((r) => ({ x: r.x, y: r.y }));
    expect(positions).toEqual(expect.arrayContaining([{ x: 1, y: 1 }, { x: 3, y: 3 }]));
    // ownerId must NOT be in the emitted payload
    expect((payload.reveals[0] as Record<string, unknown>)).not.toHaveProperty('ownerId');
  });

  it('sends empty reveals to observer sockets', async () => {
    await createToken(sceneId, campaignId, 1, 1, 6, null);

    const observerSocket = makeMockSocket('observer', 'obs-id');

    const mockIo = {
      in: vi.fn().mockReturnValue({
        fetchSockets: vi.fn().mockResolvedValue([observerSocket]),
      }),
    };

    await emitVisionSync(mockIo as never, campaignId, sceneId);

    const [, payload] = visionSyncCall(observerSocket.emit) as [string, { reveals: unknown[] }];
    expect(payload.reveals).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 4F.2 — NPC subtype vision gating
// ---------------------------------------------------------------------------

describe('emitVisionSync — NPC subtype vision gating (Phase 4F.2)', () => {
  const TEST_EMAIL_DM3 = 'vision-dm3@test.local';
  const TEST_EMAIL_PLAYER3 = 'vision-player3@test.local';

  let dmId3: string;
  let playerId3: string;
  let campaignId3: string;
  let sceneId3: string;

  beforeAll(async () => {
    for (const email of [TEST_EMAIL_DM3, TEST_EMAIL_PLAYER3]) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.campaign.deleteMany({
          where: { members: { some: { userId: user.id } } },
        });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  });

  beforeEach(async () => {
    dmId3 = await createUser('VisionDM3', TEST_EMAIL_DM3);
    playerId3 = await createUser('VisionPlayer3', TEST_EMAIL_PLAYER3);
    campaignId3 = await createCampaign(dmId3);
    sceneId3 = await createScene(campaignId3);
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({ where: { id: campaignId3 } });
    await prisma.user.deleteMany({ where: { id: { in: [dmId3, playerId3] } } });
  });

  function makeMockSocket(role: string, userId: string): { data: Record<string, unknown>; emit: ReturnType<typeof vi.fn> } {
    return { data: { campaignRole: role, userId }, emit: vi.fn() };
  }

  async function createNpcToken(
    sceneId: string,
    campaignId: string,
    npcSubtype: 'ally' | 'enemy',
  ): Promise<string> {
    const token = await prisma.token.create({
      data: { sceneId, campaignId, name: npcSubtype, type: 'npc', x: 0, y: 0, visionRadius: 6, ownerId: null, npcSubtype },
    });
    return token.id;
  }

  it('includes ally NPC token reveals in player vision sync', async () => {
    await createToken(sceneId3, campaignId3, 1, 1, 6, playerId3);
    const allyId = await createNpcToken(sceneId3, campaignId3, 'ally');

    const playerSocket = makeMockSocket('player', playerId3);
    const mockIo = {
      in: vi.fn().mockReturnValue({ fetchSockets: vi.fn().mockResolvedValue([playerSocket]) }),
    };

    await emitVisionSync(mockIo as never, campaignId3, sceneId3);

    const [, payload] = visionSyncCall(playerSocket.emit) as [string, { reveals: { tokenId: string }[] }];
    const tokenIds = payload.reveals.map((r) => r.tokenId);
    expect(tokenIds).toContain(allyId);
    // Internal fields must not leak to the client
    expect((payload.reveals[0] as Record<string, unknown>)).not.toHaveProperty('ownerId');
    expect((payload.reveals[0] as Record<string, unknown>)).not.toHaveProperty('type');
    expect((payload.reveals[0] as Record<string, unknown>)).not.toHaveProperty('npcSubtype');
  });

  it('excludes enemy NPC token reveals from player vision sync', async () => {
    await createToken(sceneId3, campaignId3, 1, 1, 6, playerId3);
    const enemyId = await createNpcToken(sceneId3, campaignId3, 'enemy');

    const playerSocket = makeMockSocket('player', playerId3);
    const mockIo = {
      in: vi.fn().mockReturnValue({ fetchSockets: vi.fn().mockResolvedValue([playerSocket]) }),
    };

    await emitVisionSync(mockIo as never, campaignId3, sceneId3);

    const [, payload] = visionSyncCall(playerSocket.emit) as [string, { reveals: { tokenId: string }[] }];
    const tokenIds = payload.reveals.map((r) => r.tokenId);
    expect(tokenIds).not.toContain(enemyId);
    // Internal fields must not leak to the client
    expect((payload.reveals[0] as Record<string, unknown>)).not.toHaveProperty('ownerId');
    expect((payload.reveals[0] as Record<string, unknown>)).not.toHaveProperty('type');
    expect((payload.reveals[0] as Record<string, unknown>)).not.toHaveProperty('npcSubtype');
  });

  it('includes both ally and enemy NPC token reveals in DM vision sync', async () => {
    const allyId = await createNpcToken(sceneId3, campaignId3, 'ally');
    const enemyId = await createNpcToken(sceneId3, campaignId3, 'enemy');

    const dmSocket = makeMockSocket('dm', dmId3);
    const mockIo = {
      in: vi.fn().mockReturnValue({ fetchSockets: vi.fn().mockResolvedValue([dmSocket]) }),
    };

    await emitVisionSync(mockIo as never, campaignId3, sceneId3);

    const [, payload] = visionSyncCall(dmSocket.emit) as [string, { reveals: { tokenId: string }[] }];
    const tokenIds = payload.reveals.map((r) => r.tokenId);
    expect(tokenIds).toContain(allyId);
    expect(tokenIds).toContain(enemyId);
    // type/npcSubtype/ownerId must NOT be present in the emitted payload
    expect((payload.reveals[0] as Record<string, unknown>)).not.toHaveProperty('ownerId');
    expect((payload.reveals[0] as Record<string, unknown>)).not.toHaveProperty('type');
    expect((payload.reveals[0] as Record<string, unknown>)).not.toHaveProperty('npcSubtype');
  });

  it('excludes null-subtype NPC tokens (enemy fallback) from player vision sync', async () => {
    // An NPC with no subtype — should behave as enemy (no player vision)
    const nullSubtypeToken = await prisma.token.create({
      data: { sceneId: sceneId3, campaignId: campaignId3, name: 'Unknown NPC', type: 'npc', x: 0, y: 0, visionRadius: 6, ownerId: null, npcSubtype: null },
    });

    await createToken(sceneId3, campaignId3, 1, 1, 6, playerId3);

    const playerSocket = makeMockSocket('player', playerId3);
    const mockIo = {
      in: vi.fn().mockReturnValue({ fetchSockets: vi.fn().mockResolvedValue([playerSocket]) }),
    };

    await emitVisionSync(mockIo as never, campaignId3, sceneId3);

    const [, payload] = visionSyncCall(playerSocket.emit) as [string, { reveals: { tokenId: string }[] }];
    const tokenIds = payload.reveals.map((r) => r.tokenId);
    expect(tokenIds).not.toContain(nullSubtypeToken.id);
  });
});

// ---------------------------------------------------------------------------
// Phase PM3 — line-of-sight polygons and doors
// ---------------------------------------------------------------------------

describe('Line of sight (Phase PM3)', () => {
  const TEST_EMAIL_DM4 = 'vision-dm4@test.local';
  const TEST_EMAIL_PLAYER4 = 'vision-player4@test.local';
  const CELL = 64;

  let dmId4: string;
  let playerId4: string;
  let campaignId4: string;
  let sceneId4: string;
  let playerTokenId: string;
  let enemyTokenId: string;
  let nearDoorId: string;
  let farDoorId: string;

  interface MockSocket {
    data: Record<string, unknown>;
    emit: ReturnType<typeof vi.fn>;
  }

  function makeMockSocket(role: string, userId: string): MockSocket {
    return { data: { campaignRole: role, userId }, emit: vi.fn() };
  }

  function visionUpdated(socket: MockSocket): VisionUpdatedPayload {
    const call = socket.emit.mock.calls.find(([event]) => event === VISION_EVENTS.VISION_UPDATED);
    if (!call) throw new Error('vision:updated was not emitted');
    return call[1] as VisionUpdatedPayload;
  }

  async function emitTo(...sockets: MockSocket[]): Promise<void> {
    const mockIo = {
      in: vi.fn().mockReturnValue({ fetchSockets: vi.fn().mockResolvedValue(sockets) }),
    };
    await emitVisionSync(mockIo as never, campaignId4, sceneId4);
  }

  function wall(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    extra: { isDoor?: boolean; isOpen?: boolean; blocksLight?: boolean } = {},
  ): Promise<{ id: string }> {
    return prisma.wallSegment.create({
      data: { campaignId: campaignId4, sceneId: sceneId4, x1, y1, x2, y2, ...extra },
      select: { id: true },
    });
  }

  function containsPoint(polygon: { x: number; y: number }[], point: { x: number; y: number }): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const a = polygon[i];
      const b = polygon[j];
      if (a.y > point.y !== b.y > point.y) {
        const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
        if (point.x < x) inside = !inside;
      }
    }
    return inside;
  }

  beforeAll(async () => {
    for (const email of [TEST_EMAIL_DM4, TEST_EMAIL_PLAYER4]) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.campaign.deleteMany({ where: { members: { some: { userId: user.id } } } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  });

  beforeEach(async () => {
    dmId4 = await createUser('VisionDM4', TEST_EMAIL_DM4);
    playerId4 = await createUser('VisionPlayer4', TEST_EMAIL_PLAYER4);
    campaignId4 = await createCampaign(dmId4);
    sceneId4 = await createScene(campaignId4);

    // Player at cell (2,2) → origin (160,160), radius 6 cells = 384px
    playerTokenId = await createToken(sceneId4, campaignId4, 2, 2, 6, playerId4);
    // Enemy NPC at cell (10,2) → origin (672,160), on the far side of the wall
    enemyTokenId = (
      await prisma.token.create({
        data: {
          sceneId: sceneId4,
          campaignId: campaignId4,
          name: 'Enemy',
          type: 'npc',
          npcSubtype: 'enemy',
          x: 10,
          y: 2,
          visionRadius: 6,
        },
      })
    ).id;
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({ where: { id: campaignId4 } });
    await prisma.user.deleteMany({ where: { id: { in: [dmId4, playerId4] } } });
  });

  async function buildRoom(): Promise<void> {
    await wall(256, 0, 256, 384);
    nearDoorId = (await wall(256, 384, 256, 448, { isDoor: true })).id;
    farDoorId = (await wall(600, 100, 600, 164, { isDoor: true })).id;
  }

  it('omits polygons and doors when the scene has no walls (clients keep circles)', async () => {
    const dm = makeMockSocket('dm', dmId4);
    await emitTo(dm);
    expect(visionUpdated(dm)).toMatchObject({ polygons: [], doors: [], sceneId: sceneId4 });
  });

  it('emits vision:updated before the token vision sync', async () => {
    await buildRoom();
    const dm = makeMockSocket('dm', dmId4);
    await emitTo(dm);
    const events = dm.emit.mock.calls.map(([event]) => event);
    expect(events).toEqual([VISION_EVENTS.VISION_UPDATED, TOKEN_VISION_EVENTS.TOKEN_VISION_SYNC]);
  });

  it('gives the DM polygons for every obstructed emitter and every door', async () => {
    await buildRoom();
    const dm = makeMockSocket('dm', dmId4);
    await emitTo(dm);

    const payload = visionUpdated(dm);
    expect(payload.polygons.map((p) => p.emitterId).sort()).toEqual(
      [playerTokenId, enemyTokenId].sort(),
    );
    expect(payload.doors.map((d) => d.id).sort()).toEqual([nearDoorId, farDoorId].sort());

    const playerPolygon = payload.polygons.find((p) => p.emitterId === playerTokenId);
    expect(playerPolygon?.origin).toEqual({ x: 2 * CELL + CELL / 2, y: 2 * CELL + CELL / 2 });
    expect(playerPolygon?.radius).toBe(6 * CELL);
    // In front of the wall is visible; directly behind it is not
    expect(containsPoint(playerPolygon?.points ?? [], { x: 200, y: 160 })).toBe(true);
    expect(containsPoint(playerPolygon?.points ?? [], { x: 320, y: 160 })).toBe(false);
  });

  it('gives players only party polygons and only doors the party can see', async () => {
    await buildRoom();
    const player = makeMockSocket('player', playerId4);
    await emitTo(player);

    const payload = visionUpdated(player);
    expect(payload.polygons.map((p) => p.emitterId)).toEqual([playerTokenId]);
    expect(payload.doors.map((d) => d.id)).toEqual([nearDoorId]);
    // Door payloads carry only the door's own geometry
    expect(Object.keys(payload.doors[0]).sort()).toEqual(['id', 'isOpen', 'x1', 'x2', 'y1', 'y2']);
  });

  it('gives observers no polygons and no doors', async () => {
    await buildRoom();
    const observer = makeMockSocket('observer', 'observer-id');
    await emitTo(observer);
    expect(visionUpdated(observer)).toMatchObject({ polygons: [], doors: [] });
  });

  it('treats open doors as see-through and closed doors as blockers', async () => {
    await buildRoom();
    // Beyond the near door along the ray from the player through its midpoint (256,416)
    const beyondDoor = { x: 288, y: 501 };

    const closed = makeMockSocket('dm', dmId4);
    await emitTo(closed);
    const closedPolygon = visionUpdated(closed).polygons.find((p) => p.emitterId === playerTokenId);
    expect(containsPoint(closedPolygon?.points ?? [], beyondDoor)).toBe(false);

    await prisma.wallSegment.update({ where: { id: nearDoorId }, data: { isOpen: true } });

    const open = makeMockSocket('dm', dmId4);
    await emitTo(open);
    const openPolygon = visionUpdated(open).polygons.find((p) => p.emitterId === playerTokenId);
    expect(containsPoint(openPolygon?.points ?? [], beyondDoor)).toBe(true);
  });

  it('ignores walls that do not block light (windows)', async () => {
    await wall(256, 0, 256, 384, { blocksLight: false });
    const dm = makeMockSocket('dm', dmId4);
    await emitTo(dm);
    expect(visionUpdated(dm).polygons).toEqual([]);
  });

  describe('enemy token line of sight', () => {
    it('lists enemies in the open as visible to the party', async () => {
      const player = makeMockSocket('player', playerId4);
      await emitTo(player);
      expect(visionUpdated(player).visibleEnemyTokenIds).toEqual([enemyTokenId]);
    });

    it('omits enemies behind a wall for players and the DM, and sends observers nothing', async () => {
      await wall(256, 0, 256, 384);
      const dm = makeMockSocket('dm', dmId4);
      const player = makeMockSocket('player', playerId4);
      const observer = makeMockSocket('observer', 'observer-id');
      await emitTo(dm, player, observer);

      expect(visionUpdated(player).visibleEnemyTokenIds).toEqual([]);
      expect(visionUpdated(dm).visibleEnemyTokenIds).toEqual([]);
      expect(visionUpdated(observer).visibleEnemyTokenIds).toEqual([]);
    });

    it('shows a large enemy when any of its cells is in sight', async () => {
      await wall(256, 0, 256, 384);
      // 2×2 at (4,6): the top-left cell is behind the wall, the cell below it is not
      const { id: ogreId } = await prisma.token.create({
        data: {
          sceneId: sceneId4,
          campaignId: campaignId4,
          name: 'Ogre',
          type: 'monster',
          x: 4,
          y: 6,
          size: 2,
          visionRadius: 0,
        },
        select: { id: true },
      });
      const player = makeMockSocket('player', playerId4);
      await emitTo(player);
      expect(visionUpdated(player).visibleEnemyTokenIds).toEqual([ogreId]);
    });

    it('hides enemies behind a closed door and shows them once it opens', async () => {
      const { id: doorId } = await wall(256, 0, 256, 384, { isDoor: true });

      const closed = makeMockSocket('player', playerId4);
      await emitTo(closed);
      expect(visionUpdated(closed).visibleEnemyTokenIds).toEqual([]);

      await prisma.wallSegment.update({ where: { id: doorId }, data: { isOpen: true } });
      const open = makeMockSocket('player', playerId4);
      await emitTo(open);
      expect(visionUpdated(open).visibleEnemyTokenIds).toEqual([enemyTokenId]);
    });

    it('uses ally NPCs as viewers and never lists allies, props, or blind viewers', async () => {
      await wall(256, 0, 256, 384);
      await prisma.token.update({ where: { id: playerTokenId }, data: { visionRadius: 0 } });
      const blind = makeMockSocket('player', playerId4);
      await emitTo(blind);
      expect(visionUpdated(blind).visibleEnemyTokenIds).toEqual([]);

      const { id: allyId } = await prisma.token.create({
        data: {
          sceneId: sceneId4,
          campaignId: campaignId4,
          name: 'Scout',
          type: 'npc',
          npcSubtype: 'ally',
          x: 8,
          y: 2,
          visionRadius: 6,
        },
        select: { id: true },
      });
      await prisma.token.create({
        data: { sceneId: sceneId4, campaignId: campaignId4, name: 'Crate', type: 'misc', x: 9, y: 3 },
      });

      const player = makeMockSocket('player', playerId4);
      await emitTo(player);
      const ids = visionUpdated(player).visibleEnemyTokenIds;
      expect(ids).toEqual([enemyTokenId]);
      expect(ids).not.toContain(allyId);
    });
  });

  it('isDoorVisibleToParty matches the player door list', async () => {
    await buildRoom();
    await expect(isDoorVisibleToParty(campaignId4, sceneId4, nearDoorId)).resolves.toBe(true);
    await expect(isDoorVisibleToParty(campaignId4, sceneId4, farDoorId)).resolves.toBe(false);
  });

  it('never records persistent exploration behind a wall', async () => {
    await buildRoom();
    await prisma.scene.update({
      where: { id: sceneId4 },
      data: { fogConfig: { fogMode: 'pm2', explorationMode: 'persistent' } },
    });

    await emitTo(makeMockSocket('dm', dmId4));

    const rows = await prisma.fogExploration.findMany({ where: { sceneId: sceneId4 } });
    expect(rows).toHaveLength(1);
    const [stamp] = rows;
    // Player origin (160,160) is 96px from the wall at x=256 — the stamp must stop there.
    expect(stamp.x + stamp.radius).toBeLessThanOrEqual(256 + 0.5);
    expect(stamp.radius).toBeLessThan(6 * CELL);
  });

  describe('light emitters reveal their radius', () => {
    function authoredLight(x: number, y: number, radius: number): Promise<{ id: string }> {
      return prisma.lightSource.create({
        data: {
          campaignId: campaignId4,
          sceneId: sceneId4,
          x,
          y,
          radius,
          color: '#ff9a3c',
          intensity: 1,
          falloff: 0.5,
          emitterType: 'torch',
          animationSeed: 1,
        },
        select: { id: true },
      });
    }

    function lightPolygons(payload: VisionUpdatedPayload): VisionUpdatedPayload['polygons'] {
      return payload.polygons.filter((p) => p.source === 'light');
    }

    it('sends lit areas to DMs and players but not observers', async () => {
      const { id } = await authoredLight(1000, 1000, 4);
      const dm = makeMockSocket('dm', dmId4);
      const player = makeMockSocket('player', playerId4);
      const observer = makeMockSocket('observer', 'observer-id');
      await emitTo(dm, player, observer);

      expect(lightPolygons(visionUpdated(dm)).map((p) => p.emitterId)).toEqual([id]);
      const [lit] = lightPolygons(visionUpdated(player));
      expect(lit).toMatchObject({ emitterId: id, origin: { x: 1000, y: 1000 }, radius: 4 * CELL });
      expect(containsPoint(lit?.points ?? [], { x: 1100, y: 1000 })).toBe(true);
      expect(visionUpdated(observer).polygons).toEqual([]);
    });

    it('clips the lit area at walls', async () => {
      await buildRoom();
      // Fireplace east of the wall at x=256, radius 3 cells = 192px
      await authoredLight(400, 160, 3);
      const dm = makeMockSocket('dm', dmId4);
      await emitTo(dm);

      const [lit] = lightPolygons(visionUpdated(dm));
      expect(containsPoint(lit?.points ?? [], { x: 300, y: 160 })).toBe(true);
      expect(containsPoint(lit?.points ?? [], { x: 230, y: 160 })).toBe(false);
    });

    it('hides lights behind walls from players until the party has line of sight', async () => {
      await buildRoom();
      // Beyond the near door as seen from the player at (160,160)
      const { id } = await authoredLight(288, 501, 2);

      const dm = makeMockSocket('dm', dmId4);
      const player = makeMockSocket('player', playerId4);
      await emitTo(dm, player);
      expect(lightPolygons(visionUpdated(player))).toEqual([]);
      expect(lightPolygons(visionUpdated(dm))).toMatchObject([{ emitterId: id, partyVisible: false }]);

      await prisma.wallSegment.update({ where: { id: nearDoorId }, data: { isOpen: true } });

      const playerAfter = makeMockSocket('player', playerId4);
      await emitTo(playerAfter);
      expect(lightPolygons(visionUpdated(playerAfter))).toMatchObject([
        { emitterId: id, partyVisible: true },
      ]);
    });

    it('shows always-on lights to players without line of sight', async () => {
      await buildRoom();
      const { id } = await authoredLight(288, 501, 2);
      await prisma.lightSource.update({ where: { id }, data: { alwaysVisible: true } });

      const player = makeMockSocket('player', playerId4);
      await emitTo(player);
      expect(lightPolygons(visionUpdated(player))).toMatchObject([
        { emitterId: id, partyVisible: true },
      ]);
    });

    describe('lights in the same sealed room', () => {
      // Sealed box (64,64)-(576,448) around the player at (160,160); a partial wall at x=320
      // hides the east half from direct sight but leaves a gap at the bottom.
      async function buildLRoom(): Promise<void> {
        await wall(64, 64, 576, 64);
        await wall(576, 64, 576, 448);
        await wall(576, 448, 64, 448);
        await wall(64, 448, 64, 64);
        await wall(320, 64, 320, 320);
      }

      async function playerLights(): Promise<VisionUpdatedPayload['polygons']> {
        const player = makeMockSocket('player', playerId4);
        await emitTo(player);
        return lightPolygons(visionUpdated(player));
      }

      beforeEach(async () => {
        // The PM3 enemy NPC sits outside this room; move it away so it can't matter
        await prisma.token.delete({ where: { id: enemyTokenId } });
      });

      it('keeps a light around the corner visible to players', async () => {
        await buildLRoom();
        const { id } = await authoredLight(448, 128, 2);
        expect(await playerLights()).toMatchObject([{ emitterId: id, partyVisible: true }]);
      });

      it('hides it again when a closed door seals the corner off', async () => {
        await buildLRoom();
        const door = await wall(320, 320, 320, 448, { isDoor: true });
        await authoredLight(448, 128, 2);
        expect(await playerLights()).toEqual([]);

        await prisma.wallSegment.update({ where: { id: door.id }, data: { isOpen: true } });
        expect(await playerLights()).toHaveLength(1);
      });

      it('falls back to sight-line only when the walls do not enclose the room', async () => {
        await buildLRoom();
        await prisma.wallSegment.deleteMany({ where: { sceneId: sceneId4, y1: 64, y2: 64 } });
        await authoredLight(448, 128, 2);
        expect(await playerLights()).toEqual([]);
      });
    });

    it('includes DM temporary lights', async () => {
      const light = createTemporaryLight(
        { campaignId: campaignId4, sceneId: sceneId4, emitterType: 'torch', x: 900, y: 900 },
        dmId4,
      );
      const player = makeMockSocket('player', playerId4);
      await emitTo(player);

      expect(lightPolygons(visionUpdated(player)).map((p) => p.emitterId)).toEqual([light.id]);
      deleteTemporaryLight(campaignId4, sceneId4, light.id);
    });

    it('does not let lit areas count toward persistent exploration', async () => {
      await prisma.token.deleteMany({ where: { sceneId: sceneId4 } });
      await authoredLight(1000, 1000, 4);
      await prisma.scene.update({
        where: { id: sceneId4 },
        data: { fogConfig: { fogMode: 'pm2', explorationMode: 'persistent' } },
      });

      await emitTo(makeMockSocket('dm', dmId4));

      expect(await prisma.fogExploration.count({ where: { sceneId: sceneId4 } })).toBe(0);
    });
  });
});
