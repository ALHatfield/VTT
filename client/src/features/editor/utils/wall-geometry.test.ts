import { describe, expect, it } from 'vitest';

import type { WallSegment } from '@vtt/shared';

import {
    distanceToSegment,
    endpointPatch,
    findEndpointAtPoint,
    findNearestVertex,
    findWallAtPoint,
    isSamePoint,
    resolveWallPoint,
    snapWallPoint,
} from './wall-geometry';

function wall(id: string, x1: number, y1: number, x2: number, y2: number): WallSegment {
  return {
    id,
    sceneId: 's',
    campaignId: 'c',
    x1,
    y1,
    x2,
    y2,
    blocksLight: true,
    blocksMovement: true,
    isDoor: false,
    isOpen: false,
    createdAt: '',
    updatedAt: '',
  };
}

describe('snapWallPoint', () => {
  it('snaps to the nearest grid intersection', () => {
    expect(snapWallPoint({ x: 95, y: 33 }, 64, false)).toEqual({ x: 64, y: 64 });
    expect(snapWallPoint({ x: 97, y: 31 }, 64, false)).toEqual({ x: 128, y: 0 });
  });

  it('handles negative coordinates', () => {
    expect(snapWallPoint({ x: -40, y: -20 }, 64, false)).toEqual({ x: -64, y: 0 });
  });

  it('returns the raw point when bypassed (Alt)', () => {
    expect(snapWallPoint({ x: 95.5, y: 33.25 }, 64, true)).toEqual({ x: 95.5, y: 33.25 });
  });

  it('returns the raw point for a non-positive cell size', () => {
    expect(snapWallPoint({ x: 10, y: 10 }, 0, false)).toEqual({ x: 10, y: 10 });
  });
});

describe('findNearestVertex', () => {
  const walls = [wall('a', 0, 0, 100, 0), wall('b', 105, 0, 200, 50)];

  it('returns the closest endpoint within tolerance', () => {
    expect(findNearestVertex(walls, { x: 103, y: 1 }, 8)).toEqual({ x: 105, y: 0 });
  });

  it('returns null when nothing is within tolerance', () => {
    expect(findNearestVertex(walls, { x: 50, y: 30 }, 8)).toBeNull();
  });

  it('ignores the excluded wall', () => {
    expect(findNearestVertex(walls, { x: 2, y: 1 }, 8, 'a')).toBeNull();
  });
});

describe('resolveWallPoint', () => {
  const base = { walls: [wall('a', 0, 0, 100, 0)], cellSize: 64, vertexTolerance: 8 };

  it('prefers an existing vertex over the grid', () => {
    expect(resolveWallPoint({ x: 97, y: 3 }, { ...base, snapToGrid: true })).toEqual({
      x: 100,
      y: 0,
    });
  });

  it('snaps to the grid when enabled and no vertex is near', () => {
    expect(resolveWallPoint({ x: 70, y: 40 }, { ...base, snapToGrid: true })).toEqual({
      x: 64,
      y: 64,
    });
  });

  it('keeps free points, rounded to whole pixels, when snapping is off', () => {
    expect(resolveWallPoint({ x: 70.6, y: 40.2 }, { ...base, snapToGrid: false })).toEqual({
      x: 71,
      y: 40,
    });
  });
});

describe('distanceToSegment', () => {
  const w = wall('a', 0, 0, 100, 0);

  it('measures perpendicular distance inside the segment', () => {
    expect(distanceToSegment({ x: 50, y: 10 }, w)).toBe(10);
  });

  it('measures distance to the nearest endpoint beyond the segment', () => {
    expect(distanceToSegment({ x: 103, y: 4 }, w)).toBe(5);
  });

  it('handles degenerate segments', () => {
    expect(distanceToSegment({ x: 3, y: 4 }, wall('d', 0, 0, 0, 0))).toBe(5);
  });
});

describe('findWallAtPoint', () => {
  const walls = [wall('a', 0, 0, 100, 0), wall('b', 0, 6, 100, 6)];

  it('returns the nearest wall within tolerance', () => {
    expect(findWallAtPoint(walls, { x: 50, y: 4 }, 8)?.id).toBe('b');
    expect(findWallAtPoint(walls, { x: 50, y: 1 }, 8)?.id).toBe('a');
  });

  it('returns null when nothing is within tolerance', () => {
    expect(findWallAtPoint(walls, { x: 50, y: 40 }, 8)).toBeNull();
  });
});

describe('findEndpointAtPoint', () => {
  const w = wall('a', 0, 0, 10, 0);

  it('returns the closer endpoint when both are in range', () => {
    expect(findEndpointAtPoint(w, { x: 2, y: 0 }, 8)).toBe('start');
    expect(findEndpointAtPoint(w, { x: 8, y: 0 }, 8)).toBe('end');
  });

  it('returns null when no endpoint is in range', () => {
    expect(findEndpointAtPoint(wall('b', 0, 0, 100, 0), { x: 50, y: 0 }, 8)).toBeNull();
  });
});

describe('isSamePoint / endpointPatch', () => {
  it('compares points exactly', () => {
    expect(isSamePoint({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(isSamePoint({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
  });

  it('builds a patch for the requested endpoint', () => {
    expect(endpointPatch('start', { x: 5, y: 6 })).toEqual({ x1: 5, y1: 6 });
    expect(endpointPatch('end', { x: 5, y: 6 })).toEqual({ x2: 5, y2: 6 });
  });
});
