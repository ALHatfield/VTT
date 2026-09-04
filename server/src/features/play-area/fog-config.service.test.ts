import { describe, expect, it } from 'vitest';

import { DEFAULT_FOG_MASK_CONFIG } from '@vtt/shared';

import { normalizeFogConfig } from './fog-config.service.js';

describe('normalizeFogConfig', () => {
  it('returns defaults for a scene that has never been configured', () => {
    expect(normalizeFogConfig(null)).toEqual(DEFAULT_FOG_MASK_CONFIG);
  });

  it('returns defaults for a non-object blob', () => {
    expect(normalizeFogConfig('legacy')).toEqual(DEFAULT_FOG_MASK_CONFIG);
    expect(normalizeFogConfig([1, 2, 3])).toEqual(DEFAULT_FOG_MASK_CONFIG);
  });

  it('merges a partial stored config over the defaults', () => {
    const result = normalizeFogConfig({ fogMode: 'pm2', shroudAlpha: 0.3 });

    expect(result).toEqual({
      ...DEFAULT_FOG_MASK_CONFIG,
      fogMode: 'pm2',
      shroudAlpha: 0.3,
    });
  });

  it('falls back to defaults when a stored value is out of range', () => {
    expect(normalizeFogConfig({ maskResolutionScale: 12 })).toEqual(DEFAULT_FOG_MASK_CONFIG);
    expect(normalizeFogConfig({ fogMode: 'holographic' })).toEqual(DEFAULT_FOG_MASK_CONFIG);
  });
});
