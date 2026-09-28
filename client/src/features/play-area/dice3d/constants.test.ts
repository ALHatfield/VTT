import { describe, expect, it } from 'vitest';

import { MAX_CONCURRENT_DICE, SUPPORTED_GEOMETRY_SIDES } from '@vtt/dice';
import { DICE_3D_MAX_DICE, DICE_3D_SUPPORTED_SIDES } from '@vtt/shared';

// Guards against drift between the shared client-facing constants and the
// renderer's actual capabilities (shared cannot depend on @vtt/dice directly).
describe('3D dice constant coupling', () => {
  it('DICE_3D_MAX_DICE matches the renderer release-position capacity', () => {
    expect(DICE_3D_MAX_DICE).toBe(MAX_CONCURRENT_DICE);
  });

  it('DICE_3D_SUPPORTED_SIDES matches the renderer geometry support', () => {
    expect([...DICE_3D_SUPPORTED_SIDES]).toEqual([...SUPPORTED_GEOMETRY_SIDES]);
  });
});
