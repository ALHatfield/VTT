// selection-utils — Phase 5B tests
import { describe, expect, it } from 'vitest';

import { rectFromPoints, rectsIntersect } from './selection-utils';

describe('rectsIntersect', () => {
  it('returns true when rectangles fully overlap', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 25, y: 25, width: 50, height: 50 };
    expect(rectsIntersect(a, b)).toBe(true);
  });

  it('returns true when rectangles partially overlap', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 50, y: 50, width: 100, height: 100 };
    expect(rectsIntersect(a, b)).toBe(true);
  });

  it('returns false when rectangles are disjoint horizontally', () => {
    const a = { x: 0, y: 0, width: 50, height: 100 };
    const b = { x: 60, y: 0, width: 50, height: 100 };
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('returns false when rectangles are disjoint vertically', () => {
    const a = { x: 0, y: 0, width: 100, height: 50 };
    const b = { x: 0, y: 60, width: 100, height: 50 };
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('returns false when rectangles share only an edge', () => {
    // Touching at x = 50 with zero overlap — treated as non-intersecting so a
    // marquee that stops exactly at a tile edge does not select the tile.
    const a = { x: 0, y: 0, width: 50, height: 100 };
    const b = { x: 50, y: 0, width: 50, height: 100 };
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('is commutative', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 50, y: 50, width: 100, height: 100 };
    expect(rectsIntersect(a, b)).toBe(rectsIntersect(b, a));
  });
});

describe('rectFromPoints', () => {
  it('returns positive-width rect when start is above-left of end', () => {
    expect(rectFromPoints(10, 20, 100, 200)).toEqual({
      x: 10,
      y: 20,
      width: 90,
      height: 180,
    });
  });

  it('normalizes when start is below-right of end (drag up-left)', () => {
    expect(rectFromPoints(100, 200, 10, 20)).toEqual({
      x: 10,
      y: 20,
      width: 90,
      height: 180,
    });
  });

  it('handles a mixed drag (right-up)', () => {
    expect(rectFromPoints(0, 100, 50, 40)).toEqual({
      x: 0,
      y: 40,
      width: 50,
      height: 60,
    });
  });

  it('returns zero-sized rect when the two points are identical', () => {
    expect(rectFromPoints(50, 50, 50, 50)).toEqual({
      x: 50,
      y: 50,
      width: 0,
      height: 0,
    });
  });
});
