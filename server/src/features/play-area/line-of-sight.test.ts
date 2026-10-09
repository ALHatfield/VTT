import { describe, expect, it } from 'vitest';

import type { FogVertex } from '@vtt/shared';

import type { LosSegment } from './line-of-sight.js';
import {
    LOS_ANGLE_EPSILON,
    SegmentGrid,
    castRay,
    circleBounds,
    collectRayAngles,
    computeVisibilityPolygon,
    cullSegmentsToCircle,
    hasLineOfSight,
    inscribedRadius,
    isSegmentVisible,
    raySegmentIntersection,
    simplifyPolygon,
} from './line-of-sight.js';

function seg(id: string, x1: number, y1: number, x2: number, y2: number): LosSegment {
  return { id, x1, y1, x2, y2 };
}

/** Ray-crossing point-in-polygon test used to assert what the polygon covers. */
function containsPoint(polygon: FogVertex[], point: FogVertex): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > point.y !== b.y > point.y) {
      const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

function signedArea(polygon: FogVertex[]): number {
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

const ORIGIN = { x: 0, y: 0 };

describe('raySegmentIntersection', () => {
  it('returns the distance to a segment the ray crosses', () => {
    expect(raySegmentIntersection(ORIGIN, 1, 0, seg('w', 10, -5, 10, 5))).toBeCloseTo(10);
  });

  it('misses segments behind the origin', () => {
    expect(raySegmentIntersection(ORIGIN, 1, 0, seg('w', -10, -5, -10, 5))).toBeNull();
  });

  it('misses when the ray passes beyond the segment endpoints', () => {
    expect(raySegmentIntersection(ORIGIN, 1, 0, seg('w', 10, 1, 10, 5))).toBeNull();
  });

  it('treats parallel and collinear segments as misses', () => {
    expect(raySegmentIntersection(ORIGIN, 1, 0, seg('w', 0, 5, 10, 5))).toBeNull();
    expect(raySegmentIntersection(ORIGIN, 1, 0, seg('w', 5, 0, 10, 0))).toBeNull();
  });

  it('ignores a wall passing through the origin itself', () => {
    expect(raySegmentIntersection(ORIGIN, 0, 1, seg('w', -5, 0, 5, 0))).toBeNull();
  });
});

describe('castRay', () => {
  it('stops at the nearest wall and reports it', () => {
    const hit = castRay(ORIGIN, 0, 100, [seg('far', 50, -5, 50, 5), seg('near', 20, -5, 20, 5)]);
    expect(hit.segmentId).toBe('near');
    expect(hit.distance).toBeCloseTo(20);
    expect(hit.x).toBeCloseTo(20);
  });

  it('is capped at the vision radius when nothing is hit', () => {
    const hit = castRay(ORIGIN, Math.PI / 2, 100, [seg('w', 50, -5, 50, 5)]);
    expect(hit.segmentId).toBeNull();
    expect(hit.distance).toBe(100);
    expect(hit.y).toBeCloseTo(100);
  });
});

describe('collectRayAngles', () => {
  it('adds ±epsilon rays around every in-range corner', () => {
    const angles = collectRayAngles(ORIGIN, 100, [seg('w', 10, 10, 10, -10)], 0);
    const corner = Math.atan2(10, 10);
    expect(angles).toEqual(
      expect.arrayContaining([corner - LOS_ANGLE_EPSILON, corner, corner + LOS_ANGLE_EPSILON]),
    );
  });

  it('adds rays where a wall crosses the vision circle', () => {
    // Endpoints are out of range; only the circle crossings at y = ±sqrt(100² − 50²) qualify.
    const angles = collectRayAngles(ORIGIN, 100, [seg('w', 50, -200, 50, 200)], 0);
    const crossing = Math.atan2(Math.sqrt(100 ** 2 - 50 ** 2), 50);
    expect(angles.some((a) => Math.abs(a - crossing) < 1e-9)).toBe(true);
    expect(angles.some((a) => Math.abs(a + crossing) < 1e-9)).toBe(true);
  });

  it('returns sorted, de-duplicated angles within (−π, π]', () => {
    const angles = collectRayAngles(ORIGIN, 100, [seg('a', 10, 0, 10, 10), seg('b', 10, 10, 0, 10)]);
    for (let i = 1; i < angles.length; i += 1) expect(angles[i]).toBeGreaterThan(angles[i - 1]);
    expect(Math.min(...angles)).toBeGreaterThan(-Math.PI - 1e-9);
    expect(Math.max(...angles)).toBeLessThanOrEqual(Math.PI);
  });
});

describe('computeVisibilityPolygon', () => {
  const origin = { x: 100, y: 100 };

  it('produces a circle-like polygon when no walls are passed', () => {
    const polygon = computeVisibilityPolygon(origin, 50, []);
    expect(polygon.length).toBeGreaterThanOrEqual(3);
    for (const p of polygon) expect(Math.hypot(p.x - origin.x, p.y - origin.y)).toBeCloseTo(50, 0);
  });

  it('hides the area behind a wall and keeps the area in front visible', () => {
    const wall = seg('w', 150, 50, 150, 150);
    const polygon = computeVisibilityPolygon(origin, 200, [wall]);

    expect(containsPoint(polygon, { x: 140, y: 100 })).toBe(true);
    expect(containsPoint(polygon, { x: 200, y: 100 })).toBe(false);
    // Past the wall's end the ray slips by the corner (±ε) and continues
    expect(containsPoint(polygon, { x: 160, y: 20 })).toBe(true);
  });

  it('builds a counter-clockwise polygon in y-up space (ascending angle order)', () => {
    const polygon = computeVisibilityPolygon(origin, 80, [seg('w', 130, 60, 130, 140)]);
    // Screen space is y-down, so ascending atan2 order has a positive shoelace area.
    expect(signedArea(polygon)).toBeGreaterThan(0);
  });

  it('keeps a token in a closed room confined to the room', () => {
    const room = [
      seg('n', 0, 0, 200, 0),
      seg('e', 200, 0, 200, 200),
      seg('s', 200, 200, 0, 200),
      seg('w', 0, 200, 0, 0),
    ];
    const polygon = computeVisibilityPolygon(origin, 500, room);
    for (const p of polygon) {
      expect(p.x).toBeGreaterThanOrEqual(-0.1);
      expect(p.x).toBeLessThanOrEqual(200.1);
      expect(p.y).toBeGreaterThanOrEqual(-0.1);
      expect(p.y).toBeLessThanOrEqual(200.1);
    }
    expect(containsPoint(polygon, { x: 300, y: 100 })).toBe(false);
  });
});

describe('inscribedRadius', () => {
  it('is the distance to the nearest wall inside the visibility polygon', () => {
    const origin = { x: 100, y: 100 };
    const polygon = computeVisibilityPolygon(origin, 200, [seg('w', 130, 0, 130, 200)]);
    expect(inscribedRadius(origin, polygon)).toBeCloseTo(30, 0);
  });

  it('is the full radius (within polygon approximation) when unobstructed', () => {
    const origin = { x: 0, y: 0 };
    const r = inscribedRadius(origin, computeVisibilityPolygon(origin, 100, []));
    expect(r).toBeLessThanOrEqual(100);
    expect(r).toBeGreaterThan(99);
  });
});

describe('simplifyPolygon', () => {
  it('drops collinear and duplicate vertices', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(simplifyPolygon(square)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
  });
});

describe('obstacle culling', () => {
  it('cullSegmentsToCircle keeps only walls that enter the circle', () => {
    const near = seg('near', 20, -5, 20, 5);
    const far = seg('far', 500, -5, 500, 5);
    expect(cullSegmentsToCircle(ORIGIN, 100, [near, far])).toEqual([near]);
  });

  it('SegmentGrid only returns segments in buckets overlapping the query', () => {
    const near = seg('near', 10, 10, 20, 20);
    const far = seg('far', 5000, 5000, 5010, 5010);
    const grid = new SegmentGrid([near, far], 256);

    expect(grid.query(circleBounds({ x: 15, y: 15 }, 100))).toEqual([near]);
    expect(grid.query(circleBounds({ x: 5005, y: 5005 }, 100))).toEqual([far]);
  });

  it('SegmentGrid de-duplicates segments spanning several buckets', () => {
    const long = seg('long', 0, 0, 1000, 0);
    const grid = new SegmentGrid([long], 100);
    expect(grid.query({ minX: 0, minY: -10, maxX: 1000, maxY: 10 })).toEqual([long]);
  });

  it('SegmentGrid always returns oversized segments rather than bucketing them', () => {
    const huge = seg('huge', -90_000, -90_000, 90_000, 90_000);
    const grid = new SegmentGrid([huge], 64);
    expect(grid.query(circleBounds({ x: 50_000, y: -50_000 }, 10))).toEqual([huge]);
  });
});

describe('door visibility helpers', () => {
  const wall = seg('wall', 50, -100, 50, 100);

  it('hasLineOfSight is blocked by an intervening wall and limited by radius', () => {
    expect(hasLineOfSight(ORIGIN, { x: 40, y: 0 }, 100, [wall])).toBe(true);
    expect(hasLineOfSight(ORIGIN, { x: 60, y: 0 }, 100, [wall])).toBe(false);
    expect(hasLineOfSight(ORIGIN, { x: 0, y: 150 }, 100, [])).toBe(false);
  });

  it('isSegmentVisible ignores the door itself when it is a blocker', () => {
    const door = seg('door', 30, -10, 30, 10);
    expect(isSegmentVisible(ORIGIN, 100, door, [door])).toBe(true);
  });

  it('isSegmentVisible is false for a door behind a wall', () => {
    const door = seg('door', 80, -10, 80, 10);
    expect(isSegmentVisible(ORIGIN, 100, door, [wall, door])).toBe(false);
  });
});

describe('performance', () => {
  it('recomputes 4 emitters against 200+ local segments in under 8 ms', () => {
    const segments: LosSegment[] = [];
    // 15×15 lattice of short pillars scattered through the combat area.
    for (let gx = 0; gx < 15; gx += 1) {
      for (let gy = 0; gy < 15; gy += 1) {
        const x = gx * 64 + 16;
        const y = gy * 64 + 16;
        segments.push(seg(`s-${gx}-${gy}`, x, y, x + 24, y + (gx % 2 === 0 ? 0 : 24)));
      }
    }
    expect(segments.length).toBeGreaterThanOrEqual(200);

    const grid = new SegmentGrid(segments, 256);
    const emitters = [
      { x: 200, y: 200 },
      { x: 600, y: 300 },
      { x: 400, y: 700 },
      { x: 800, y: 800 },
    ];
    const radius = 6 * 64;

    const run = (): void => {
      for (const origin of emitters) {
        const local = cullSegmentsToCircle(origin, radius, grid.query(circleBounds(origin, radius)));
        computeVisibilityPolygon(origin, radius, local);
      }
    };

    run(); // warm up the JIT
    const runs = 10;
    const start = performance.now();
    for (let i = 0; i < runs; i += 1) run();
    const averageMs = (performance.now() - start) / runs;

    expect(averageMs).toBeLessThan(8);
  });
});
