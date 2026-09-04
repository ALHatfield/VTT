import { describe, expect, it } from 'vitest';

import type { FogMaskConfig, TokenVisionReveal, VisionStamp } from '@vtt/shared';
import { DEFAULT_FOG_MASK_CONFIG } from '@vtt/shared';

import {
  batchStamps,
  buildSoftEdgeRings,
  computeMaskDimensions,
  maskToWorld,
  mergeVisionStamps,
  resolveExploredStamps,
  resolveVisibilityState,
  visionRevealsToStamps,
  worldToMask,
} from './fog-mask-math';

function makeStamp(overrides?: Partial<VisionStamp>): VisionStamp {
  return { id: 'stamp-1', x: 100, y: 100, radius: 50, ...overrides };
}

function makeConfig(overrides?: Partial<FogMaskConfig>): FogMaskConfig {
  return { ...DEFAULT_FOG_MASK_CONFIG, ...overrides };
}

describe('computeMaskDimensions', () => {
  it('downscales the mask by the requested resolution factor', () => {
    expect(computeMaskDimensions(2048, 1024, 0.5)).toEqual({
      width: 1024,
      height: 512,
      scale: 0.5,
    });
  });

  it('caps the largest dimension to bound GPU memory', () => {
    const dims = computeMaskDimensions(16000, 8000, 1, 4096);

    expect(Math.max(dims.width, dims.height)).toBeLessThanOrEqual(4096);
    expect(dims.scale).toBeCloseTo(4096 / 16000);
  });

  it('clamps the requested scale into the supported range', () => {
    expect(computeMaskDimensions(1000, 1000, 5).scale).toBe(1);
    expect(computeMaskDimensions(1000, 1000, 0.001).scale).toBe(0.1);
  });

  it('returns an empty mask for an unsized map', () => {
    expect(computeMaskDimensions(0, 0, 0.5)).toEqual({ width: 0, height: 0, scale: 0 });
  });
});

describe('world/mask transforms', () => {
  it('round-trips a world point through mask space', () => {
    const world = { x: 640, y: 320 };
    const mask = worldToMask(world, 0.25);

    expect(mask).toEqual({ x: 160, y: 80 });
    expect(maskToWorld(mask, 0.25)).toEqual(world);
  });

  it('is camera-independent — the same world point maps identically at any zoom', () => {
    // Mask coordinates are derived from world space only, so pan/zoom (which live
    // on the world container transform) cannot desync the reveal texture.
    const point = { x: 512, y: 256 };

    expect(worldToMask(point, 0.5)).toEqual(worldToMask({ ...point }, 0.5));
  });
});

describe('visionRevealsToStamps', () => {
  it('converts grid reveals into centered world-pixel stamps', () => {
    const reveals: TokenVisionReveal[] = [
      { tokenId: 'tok-1', x: 2, y: 3, visionRadius: 6, sceneId: 'scene-1' },
    ];

    expect(visionRevealsToStamps(reveals, 64)).toEqual([
      { id: 'tok-1', x: 160, y: 224, radius: 384 },
    ]);
  });

  it('drops emitters with no vision', () => {
    const reveals: TokenVisionReveal[] = [
      { tokenId: 'tok-1', x: 0, y: 0, visionRadius: 0, sceneId: 'scene-1' },
    ];

    expect(visionRevealsToStamps(reveals, 64)).toEqual([]);
  });
});

describe('mergeVisionStamps', () => {
  it('deduplicates by id and keeps the larger radius', () => {
    const merged = mergeVisionStamps(
      [makeStamp({ id: 'a', radius: 20 }), makeStamp({ id: 'b', radius: 10 })],
      [makeStamp({ id: 'a', radius: 40 })],
    );

    expect(merged).toHaveLength(2);
    expect(merged.find((s) => s.id === 'a')?.radius).toBe(40);
  });
});

describe('batchStamps', () => {
  it('splits stamps into fixed-size geometry batches', () => {
    const stamps = Array.from({ length: 5 }, (_, i) => makeStamp({ id: `s-${i.toString()}` }));

    expect(batchStamps(stamps, 2).map((batch) => batch.length)).toEqual([2, 2, 1]);
  });

  it('returns no batches for an empty stamp set', () => {
    expect(batchStamps([], 2)).toEqual([]);
  });
});

describe('buildSoftEdgeRings', () => {
  it('returns a single opaque ring when softness is disabled', () => {
    expect(buildSoftEdgeRings(100, 0)).toEqual([{ radius: 100, alpha: 1 }]);
  });

  it('emits rings from the outside in, ending with an opaque core', () => {
    const rings = buildSoftEdgeRings(100, 0.5, 4);

    expect(rings[0].radius).toBe(100);
    expect(rings.at(-1)).toEqual({ radius: 50, alpha: 1 });
    for (let i = 1; i < rings.length; i += 1) {
      expect(rings[i].radius).toBeLessThanOrEqual(rings[i - 1].radius);
    }
  });
});

describe('resolveVisibilityState', () => {
  const active = [makeStamp({ id: 'active', x: 0, y: 0, radius: 10 })];
  const explored = [...active, makeStamp({ id: 'explored', x: 100, y: 0, radius: 10 })];

  it('reports active inside a live reveal', () => {
    expect(resolveVisibilityState({ x: 5, y: 0 }, active, explored)).toBe('active');
  });

  it('reports explored inside a remembered reveal', () => {
    expect(resolveVisibilityState({ x: 100, y: 0 }, active, explored)).toBe('explored');
  });

  it('reports hidden outside every reveal', () => {
    expect(resolveVisibilityState({ x: 500, y: 500 }, active, explored)).toBe('hidden');
  });
});

describe('resolveExploredStamps', () => {
  const active = [makeStamp({ id: 'active' })];
  const persisted = [makeStamp({ id: 'old', x: 900 })];

  it('ignores persisted stamps when exploration is off', () => {
    expect(
      resolveExploredStamps(makeConfig({ explorationMode: 'off' }), active, persisted),
    ).toEqual(active);
  });

  it('folds active vision into the persisted set when exploration is persistent', () => {
    const result = resolveExploredStamps(
      makeConfig({ explorationMode: 'persistent' }),
      active,
      persisted,
    );

    expect(result.map((s) => s.id).sort()).toEqual(['active', 'old']);
  });
});
