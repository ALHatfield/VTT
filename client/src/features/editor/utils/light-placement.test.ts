import { describe, expect, it } from 'vitest';

import {
    LIGHT_DRAG_MIME,
    findLightAt,
    hexToNumber,
    parseLightPresetDrag,
    snapLightPoint,
} from './light-placement';

describe('parseLightPresetDrag', () => {
  it('accepts known emitter types', () => {
    expect(parseLightPresetDrag('torch')).toBe('torch');
    expect(parseLightPresetDrag('beacon')).toBe('beacon');
  });

  it('rejects foreign payloads', () => {
    expect(parseLightPresetDrag('')).toBeNull();
    expect(parseLightPresetDrag('{"id":"asset"}')).toBeNull();
    expect(parseLightPresetDrag(LIGHT_DRAG_MIME)).toBeNull();
  });
});

describe('snapLightPoint', () => {
  it('snaps to the half-cell lattice', () => {
    expect(snapLightPoint({ x: 30, y: 70 }, 64, false)).toEqual({ x: 32, y: 64 });
    expect(snapLightPoint({ x: 100, y: 10 }, 64, false)).toEqual({ x: 96, y: 0 });
  });

  it('leaves the point unchanged when bypassed or the grid is invalid', () => {
    expect(snapLightPoint({ x: 30, y: 70 }, 64, true)).toEqual({ x: 30, y: 70 });
    expect(snapLightPoint({ x: 30, y: 70 }, 0, false)).toEqual({ x: 30, y: 70 });
  });
});

describe('findLightAt', () => {
  const lights = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 8, y: 0 },
  ];

  it('returns the nearest light within the hit radius', () => {
    expect(findLightAt(lights, { x: 5, y: 0 }, 10)?.id).toBe('b');
    expect(findLightAt(lights, { x: 2, y: 0 }, 10)?.id).toBe('a');
  });

  it('returns null when nothing is in range', () => {
    expect(findLightAt(lights, { x: 50, y: 50 }, 10)).toBeNull();
  });
});

describe('hexToNumber', () => {
  it('parses #rrggbb', () => {
    expect(hexToNumber('#ff9a3c')).toBe(0xff9a3c);
  });
});
