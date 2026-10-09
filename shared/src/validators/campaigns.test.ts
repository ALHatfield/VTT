import { describe, expect, it } from 'vitest';

import { campaignCreatePayloadSchema, campaignUpdatePayloadSchema } from './campaigns.js';

describe('campaignCreatePayloadSchema — gameSystem', () => {
  it('defaults gameSystem to dnd5e when omitted', () => {
    const result = campaignCreatePayloadSchema.safeParse({ name: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gameSystem).toBe('dnd5e');
    }
  });

  it('accepts dnd5e explicitly', () => {
    const result = campaignCreatePayloadSchema.safeParse({ name: 'Test', gameSystem: 'dnd5e' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gameSystem).toBe('dnd5e');
    }
  });

  it('accepts pf2e', () => {
    const result = campaignCreatePayloadSchema.safeParse({ name: 'Test', gameSystem: 'pf2e' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gameSystem).toBe('pf2e');
    }
  });

  it('rejects an unsupported system', () => {
    const result = campaignCreatePayloadSchema.safeParse({ name: 'Test', gameSystem: 'gurps' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.gameSystem).toContain(
        'Game system must be dnd5e or pf2e',
      );
    }
  });
});

describe('campaignUpdatePayloadSchema — gameSystem', () => {
  it('rejects any attempt to change the game system', () => {
    const result = campaignUpdatePayloadSchema.safeParse({
      name: 'Renamed',
      gameSystem: 'pf2e',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.gameSystem).toContain(
        'Game system cannot be changed after creation',
      );
    }
  });

  it('accepts updates without gameSystem', () => {
    const result = campaignUpdatePayloadSchema.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });
});
