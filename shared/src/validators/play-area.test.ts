import { describe, expect, it } from 'vitest';

import { tokenCreatePayloadSchema, tokenUpdatePayloadSchema } from './play-area.js';

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
    const result = tokenCreatePayloadSchema.safeParse({ name: 'Boss', type: 'monster', x: 0, y: 0, npcSubtype: 'ally' });
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
