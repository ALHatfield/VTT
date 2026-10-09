import { describe, expect, it } from 'vitest';

import { DICE_3D_MAX_DICE, DICE_3D_SUPPORTED_SIDES } from '@vtt/shared';

import { SUPPORTED_GEOMETRY_SIDES } from '../renderer/geometry';
import { MAX_CONCURRENT_DICE } from '../renderer/scene';

// Guards against drift between the shared client-facing constants and the
// renderer's actual capabilities (shared cannot depend on client code directly).
describe('3D dice constant coupling', () => {
  it('DICE_3D_MAX_DICE matches the renderer release-position capacity', () => {
    expect(DICE_3D_MAX_DICE).toBe(MAX_CONCURRENT_DICE);
  });

  it('DICE_3D_SUPPORTED_SIDES matches the renderer geometry support', () => {
    expect([...DICE_3D_SUPPORTED_SIDES]).toEqual([...SUPPORTED_GEOMETRY_SIDES]);
  });
});
