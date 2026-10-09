// Wall geometry helpers — Phase 5F
import type { WallSegment } from '@vtt/shared';

export interface WallPoint {
  x: number;
  y: number;
}

export type WallEndpoint = 'start' | 'end';

/** Snap to the nearest grid intersection; `bypass` (Alt held) returns the raw point. */
export function snapWallPoint(point: WallPoint, cellSize: number, bypass: boolean): WallPoint {
  if (bypass || cellSize <= 0) return { x: point.x, y: point.y };
  // `+ 0` normalises -0 so snapped points compare and serialise cleanly
  return {
    x: Math.round(point.x / cellSize) * cellSize + 0,
    y: Math.round(point.y / cellSize) * cellSize + 0,
  };
}

export function isSamePoint(a: WallPoint, b: WallPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Nearest existing wall endpoint within `tolerance`, ignoring `excludeWallId`. */
export function findNearestVertex(
  walls: readonly WallSegment[],
  point: WallPoint,
  tolerance: number,
  excludeWallId?: string,
): WallPoint | null {
  let best: WallPoint | null = null;
  let bestDistance = tolerance;
  for (const wall of walls) {
    if (wall.id === excludeWallId) continue;
    for (const vertex of [
      { x: wall.x1, y: wall.y1 },
      { x: wall.x2, y: wall.y2 },
    ]) {
      const distance = Math.hypot(point.x - vertex.x, point.y - vertex.y);
      if (distance <= bestDistance) {
        best = vertex;
        bestDistance = distance;
      }
    }
  }
  return best;
}

export interface ResolveWallPointOptions {
  walls: readonly WallSegment[];
  cellSize: number;
  snapToGrid: boolean;
  /** World-space radius for joining to existing wall vertices. */
  vertexTolerance: number;
  excludeWallId?: string;
}

/**
 * Final placement for a pointer position: an existing wall vertex wins so walls
 * join exactly, then the grid (when enabled), else the raw point rounded to whole px.
 */
export function resolveWallPoint(raw: WallPoint, options: ResolveWallPointOptions): WallPoint {
  const vertex = findNearestVertex(
    options.walls,
    raw,
    options.vertexTolerance,
    options.excludeWallId,
  );
  if (vertex) return vertex;
  if (options.snapToGrid) return snapWallPoint(raw, options.cellSize, false);
  return { x: Math.round(raw.x) + 0, y: Math.round(raw.y) + 0 };
}

/** Shortest distance from `point` to the wall segment. */
export function distanceToSegment(point: WallPoint, wall: WallSegment): number {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / lengthSq));
  return Math.hypot(point.x - (wall.x1 + t * dx), point.y - (wall.y1 + t * dy));
}

/** Nearest wall within `tolerance` of `point`, or null. */
export function findWallAtPoint(
  walls: readonly WallSegment[],
  point: WallPoint,
  tolerance: number,
): WallSegment | null {
  let best: WallSegment | null = null;
  let bestDistance = tolerance;
  for (const wall of walls) {
    const distance = distanceToSegment(point, wall);
    if (distance <= bestDistance) {
      best = wall;
      bestDistance = distance;
    }
  }
  return best;
}

/** Which endpoint of `wall` lies within `tolerance` of `point`, preferring the closer one. */
export function findEndpointAtPoint(
  wall: WallSegment,
  point: WallPoint,
  tolerance: number,
): WallEndpoint | null {
  const startDistance = Math.hypot(point.x - wall.x1, point.y - wall.y1);
  const endDistance = Math.hypot(point.x - wall.x2, point.y - wall.y2);
  if (startDistance > tolerance && endDistance > tolerance) return null;
  return startDistance <= endDistance ? 'start' : 'end';
}

/** Endpoint patch for moving one end of a wall to `point`. */
export function endpointPatch(
  endpoint: WallEndpoint,
  point: WallPoint,
): { x1: number; y1: number } | { x2: number; y2: number } {
  return endpoint === 'start' ? { x1: point.x, y1: point.y } : { x2: point.x, y2: point.y };
}
