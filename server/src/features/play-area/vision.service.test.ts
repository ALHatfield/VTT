import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';
import { computeTokenVisionRegions, emitVisionSync } from './vision.service.js';

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

    expect(dmSocket.emit).toHaveBeenCalledOnce();
    const [event, payload] = dmSocket.emit.mock.calls[0] as [string, { reveals: unknown[] }];
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

    const [, payload] = playerSocket.emit.mock.calls[0] as [string, { reveals: { tokenId: string; x: number; y: number }[] }];
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

    const [, payload] = observerSocket.emit.mock.calls[0] as [string, { reveals: unknown[] }];
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

    const [, payload] = playerSocket.emit.mock.calls[0] as [string, { reveals: { tokenId: string }[] }];
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

    const [, payload] = playerSocket.emit.mock.calls[0] as [string, { reveals: { tokenId: string }[] }];
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

    const [, payload] = dmSocket.emit.mock.calls[0] as [string, { reveals: { tokenId: string }[] }];
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

    const [, payload] = playerSocket.emit.mock.calls[0] as [string, { reveals: { tokenId: string }[] }];
    const tokenIds = payload.reveals.map((r) => r.tokenId);
    expect(tokenIds).not.toContain(nullSubtypeToken.id);
  });
});
