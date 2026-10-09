import { describe, expect, it } from 'vitest';

import {
    doorTogglePayloadSchema,
    initiativeAdvancePayloadSchema,
    initiativeEndPayloadSchema,
    initiativeReorderPayloadSchema,
    initiativeStartPayloadSchema,
    temporaryLightCreatePayloadSchema,
    temporaryLightDeletePayloadSchema,
    temporaryLightUpdatePayloadSchema,
    tokenCreatePayloadSchema,
    tokenUpdatePayloadSchema,
    visionRefreshPayloadSchema,
} from './play-area.js';

// ---------------------------------------------------------------------------
// Phase PM3 — line of sight validators
// ---------------------------------------------------------------------------

describe('line-of-sight payload schemas (Phase PM3)', () => {
  const target = {
    campaignId: '11111111-1111-4111-8111-111111111111',
    sceneId: '22222222-2222-4222-8222-222222222222',
  };
  const wallId = '33333333-3333-4333-8333-333333333333';

  it('accepts a vision refresh for a campaign scene', () => {
    expect(visionRefreshPayloadSchema.safeParse(target).success).toBe(true);
  });

  it('rejects vision refresh with bad ids or extra fields', () => {
    expect(visionRefreshPayloadSchema.safeParse({ ...target, sceneId: '' }).success).toBe(false);
    expect(visionRefreshPayloadSchema.safeParse({ ...target, force: true }).success).toBe(false);
  });

  it('accepts seeded, non-UUID campaign and scene ids', () => {
    const seeded = { campaignId: 'campaign-seed-001', sceneId: 'scene-seed-001' };
    expect(visionRefreshPayloadSchema.safeParse(seeded).success).toBe(true);
    expect(doorTogglePayloadSchema.safeParse({ ...seeded, wallId }).success).toBe(true);
  });

  it('accepts a door toggle and requires a bounded wallId', () => {
    expect(doorTogglePayloadSchema.safeParse({ ...target, wallId }).success).toBe(true);
    expect(doorTogglePayloadSchema.safeParse(target).success).toBe(false);
    expect(doorTogglePayloadSchema.safeParse({ ...target, wallId: '' }).success).toBe(false);
    expect(
      doorTogglePayloadSchema.safeParse({ ...target, wallId: 'x'.repeat(65) }).success,
    ).toBe(false);
  });

  it('rejects clients trying to set the door state directly', () => {
    expect(doorTogglePayloadSchema.safeParse({ ...target, wallId, isOpen: true }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Phase PM4 — temporary light validators
// ---------------------------------------------------------------------------

describe('temporary light payload schemas (Phase PM4)', () => {
  const target = {
    campaignId: '11111111-1111-4111-8111-111111111111',
    sceneId: '22222222-2222-4222-8222-222222222222',
  };
  const lightId = '33333333-3333-4333-8333-333333333333';

  it('accepts a minimal create and leaves preset fields optional', () => {
    const result = temporaryLightCreatePayloadSchema.safeParse({
      ...target,
      emitterType: 'torch',
      x: 10,
      y: 20,
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown emitter types, bad colors, and out-of-range intensity', () => {
    const base = { ...target, emitterType: 'torch', x: 0, y: 0 };
    expect(temporaryLightCreatePayloadSchema.safeParse({ ...base, emitterType: 'sun' }).success).toBe(false);
    expect(temporaryLightCreatePayloadSchema.safeParse({ ...base, color: 'red' }).success).toBe(false);
    expect(temporaryLightCreatePayloadSchema.safeParse({ ...base, intensity: 1.5 }).success).toBe(false);
  });

  it('rejects a create without campaign or scene', () => {
    expect(
      temporaryLightCreatePayloadSchema.safeParse({ emitterType: 'torch', x: 0, y: 0 }).success,
    ).toBe(false);
  });

  it('rejects non-UUID ids', () => {
    expect(
      temporaryLightCreatePayloadSchema.safeParse({
        campaignId: 'c1',
        sceneId: target.sceneId,
        emitterType: 'torch',
        x: 0,
        y: 0,
      }).success,
    ).toBe(false);
    expect(temporaryLightDeletePayloadSchema.safeParse({ ...target, lightId: 'l1' }).success).toBe(false);
  });

  it('requires at least one change on update and rejects server-owned fields', () => {
    const base = { ...target, lightId };
    expect(temporaryLightUpdatePayloadSchema.safeParse({ ...base, changes: {} }).success).toBe(false);
    expect(
      temporaryLightUpdatePayloadSchema.safeParse({ ...base, changes: { animationSeed: 1 } }).success,
    ).toBe(false);
    expect(
      temporaryLightUpdatePayloadSchema.safeParse({ ...base, changes: { radius: 4 } }).success,
    ).toBe(true);
  });

  it('requires a lightId on delete', () => {
    expect(temporaryLightDeletePayloadSchema.safeParse(target).success).toBe(false);
    expect(temporaryLightDeletePayloadSchema.safeParse({ ...target, lightId }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 4F.2 — npcSubtype validator tests
// ---------------------------------------------------------------------------

describe('tokenCreatePayloadSchema — npcSubtype (Phase 4F.2)', () => {
  const base = { name: 'Guard', type: 'npc' as const, x: 0, y: 0 };

  it('accepts "ally" as a valid npcSubtype', () => {
    const result = tokenCreatePayloadSchema.safeParse({ ...base, npcSubtype: 'ally' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.npcSubtype).toBe('ally');
  });

  it('accepts "enemy" as a valid npcSubtype', () => {
    const result = tokenCreatePayloadSchema.safeParse({ ...base, npcSubtype: 'enemy' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.npcSubtype).toBe('enemy');
  });

  it('accepts omitted npcSubtype (optional field)', () => {
    const result = tokenCreatePayloadSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.npcSubtype).toBeUndefined();
  });

  it('rejects invalid npcSubtype values', () => {
    const result = tokenCreatePayloadSchema.safeParse({ ...base, npcSubtype: 'neutral' });
    expect(result.success).toBe(false);
  });

  it('rejects null npcSubtype on create (use update to clear)', () => {
    const result = tokenCreatePayloadSchema.safeParse({ ...base, npcSubtype: null });
    expect(result.success).toBe(false);
  });

  it('rejects npcSubtype on non-NPC token types', () => {
    const result = tokenCreatePayloadSchema.safeParse({
      name: 'Boss',
      type: 'monster',
      x: 0,
      y: 0,
      npcSubtype: 'ally',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('npcSubtype');
    }
  });
});

describe('tokenUpdatePayloadSchema — npcSubtype (Phase 4F.2)', () => {
  it('accepts "ally" as npcSubtype update', () => {
    const result = tokenUpdatePayloadSchema.safeParse({ npcSubtype: 'ally' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.npcSubtype).toBe('ally');
  });

  it('accepts "enemy" as npcSubtype update', () => {
    const result = tokenUpdatePayloadSchema.safeParse({ npcSubtype: 'enemy' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.npcSubtype).toBe('enemy');
  });

  it('accepts null npcSubtype to clear the subtype', () => {
    const result = tokenUpdatePayloadSchema.safeParse({ npcSubtype: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.npcSubtype).toBeNull();
  });

  it('rejects invalid npcSubtype string on update', () => {
    const result = tokenUpdatePayloadSchema.safeParse({ npcSubtype: 'neutral' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 4H — initiative validator tests
// ---------------------------------------------------------------------------

describe('initiative payload schemas (Phase 4H)', () => {
  it('accepts initiative start with an optional token list', () => {
    const result = initiativeStartPayloadSchema.safeParse({
      campaignId: 'campaign-1',
      tokenIds: ['token-1', 'token-2'],
    });

    expect(result.success).toBe(true);
  });

  it('rejects initiative start with an explicit empty token list', () => {
    const result = initiativeStartPayloadSchema.safeParse({
      campaignId: 'campaign-1',
      tokenIds: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects duplicate initiative start token ids', () => {
    const result = initiativeStartPayloadSchema.safeParse({
      campaignId: 'campaign-1',
      tokenIds: ['token-1', 'token-1'],
    });

    expect(result.success).toBe(false);
  });

  it('accepts initiative advance payloads', () => {
    const result = initiativeAdvancePayloadSchema.safeParse({ campaignId: 'campaign-1' });

    expect(result.success).toBe(true);
  });

  it('accepts initiative end payloads', () => {
    const result = initiativeEndPayloadSchema.safeParse({ campaignId: 'campaign-1' });

    expect(result.success).toBe(true);
  });

  it('rejects empty initiative reorder lists', () => {
    const result = initiativeReorderPayloadSchema.safeParse({
      campaignId: 'campaign-1',
      tokenIds: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects duplicate initiative reorder token ids', () => {
    const result = initiativeReorderPayloadSchema.safeParse({
      campaignId: 'campaign-1',
      tokenIds: ['token-1', 'token-1'],
    });

    expect(result.success).toBe(false);
  });
});
