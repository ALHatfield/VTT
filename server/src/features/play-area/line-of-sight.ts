// Line-of-sight raycasting — Phase PM3
// CPU-side geometry only: produces visibility polygons that the client composes into the fog mask.
import type { FogVertex, ObstacleBounds, RaycastHit } from '@vtt/shared';

/** A blocking obstacle segment in world pixels. */
export interface LosSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Rays cast around the full circle so unobstructed arcs stay round. */
export const LOS_CIRCLE_STEPS = 48;
/** Angular offset (radians) either side of a corner so rays slip past vertices. */
export const LOS_ANGLE_EPSILON = 1e-4;
/** Ignore hits this close to the origin so a token standing on a wall is not fully blinded. */
const LOS_MIN_HIT_DISTANCE = 1e-6;
/** A wall passing exactly through the target (e.g. a wall-mounted light) does not hide it. */
const LOS_TARGET_TOLERANCE = 1e-3;
/** Parametric slack when testing whether a hit lies within a segment's endpoints. */
const LOS_SEGMENT_EPSILON = 1e-9;
/** Outgoing coordinates are rounded to this many decimal places to keep payloads small. */
const LOS_COORDINATE_PRECISION = 10;
/** Cross-product tolerance (px²) for dropping collinear polygon vertices. */
const LOS_COLLINEAR_TOLERANCE = 0.01;
/** Segments spanning more buckets than this skip bucketing and are always returned. */
const MAX_BUCKETS_PER_SEGMENT = 256;
/** Fractions along a door that are sampled when testing whether the door is visible. */
const DOOR_SAMPLE_FRACTIONS = [0.1, 0.5, 0.9] as const;

const TWO_PI = Math.PI * 2;

/**
 * Distance along a unit-direction ray to the segment, or null when the ray misses.
 * Parallel and collinear rays are treated as misses.
 */
export function raySegmentIntersection(
  origin: FogVertex,
  dirX: number,
  dirY: number,
  segment: LosSegment,
): number | null {
  const ex = segment.x2 - segment.x1;
  const ey = segment.y2 - segment.y1;
  const denom = dirX * ey - dirY * ex;
  if (Math.abs(denom) < LOS_SEGMENT_EPSILON) return null;

  const wx = segment.x1 - origin.x;
  const wy = segment.y1 - origin.y;
  const t = (wx * ey - wy * ex) / denom;
  const u = (wx * dirY - wy * dirX) / denom;

  if (t < LOS_MIN_HIT_DISTANCE) return null;
  if (u < -LOS_SEGMENT_EPSILON || u > 1 + LOS_SEGMENT_EPSILON) return null;
  return t;
}

/** Cast one ray and return the nearest obstacle hit, capped at `radius`. */
export function castRay(
  origin: FogVertex,
  angle: number,
  radius: number,
  segments: readonly LosSegment[],
): RaycastHit {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  let distance = radius;
  let segmentId: string | null = null;

  for (const segment of segments) {
    const t = raySegmentIntersection(origin, dirX, dirY, segment);
    if (t !== null && t < distance) {
      distance = t;
      segmentId = segment.id;
    }
  }

  return { x: origin.x + dirX * distance, y: origin.y + dirY * distance, distance, segmentId };
}

/** Shortest distance from a point to a segment. */
export function pointSegmentDistance(point: FogVertex, segment: LosSegment): number {
  const ex = segment.x2 - segment.x1;
  const ey = segment.y2 - segment.y1;
  const lengthSq = ex * ex + ey * ey;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - segment.x1) * ex + (point.y - segment.y1) * ey) / lengthSq),
        );
  return Math.hypot(point.x - (segment.x1 + ex * t), point.y - (segment.y1 + ey * t));
}

export function circleBounds(origin: FogVertex, radius: number): ObstacleBounds {
  return {
    minX: origin.x - radius,
    minY: origin.y - radius,
    maxX: origin.x + radius,
    maxY: origin.y + radius,
  };
}

/** Keep only segments that actually enter the vision circle. */
export function cullSegmentsToCircle(
  origin: FogVertex,
  radius: number,
  segments: readonly LosSegment[],
): LosSegment[] {
  return segments.filter((segment) => pointSegmentDistance(origin, segment) <= radius);
}

function normalizeAngle(angle: number): number {
  let a = angle % TWO_PI;
  if (a <= -Math.PI) a += TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  return a;
}

/** Angles where a segment crosses the vision circle boundary. */
function circleCrossingAngles(origin: FogVertex, radius: number, segment: LosSegment): number[] {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const fx = segment.x1 - origin.x;
  const fy = segment.y1 - origin.y;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (a === 0 || discriminant < 0) return [];

  const root = Math.sqrt(discriminant);
  const angles: number[] = [];
  for (const t of [(-b - root) / (2 * a), (-b + root) / (2 * a)]) {
    if (t < 0 || t > 1) continue;
    angles.push(Math.atan2(fy + dy * t, fx + dx * t));
  }
  return angles;
}

/**
 * Ray angles for one emitter: every in-range corner (±ε so rays slip past it),
 * every point where a wall crosses the vision circle, and a fixed ring of
 * angles so open arcs stay round. Sorted ascending, duplicates removed.
 */
export function collectRayAngles(
  origin: FogVertex,
  radius: number,
  segments: readonly LosSegment[],
  circleSteps: number = LOS_CIRCLE_STEPS,
): number[] {
  const angles: number[] = [];

  for (let i = 0; i < circleSteps; i += 1) {
    angles.push(-Math.PI + (TWO_PI * i) / circleSteps);
  }

  const addWithOffsets = (angle: number): void => {
    angles.push(angle - LOS_ANGLE_EPSILON, angle, angle + LOS_ANGLE_EPSILON);
  };

  for (const segment of segments) {
    for (const [x, y] of [
      [segment.x1, segment.y1],
      [segment.x2, segment.y2],
    ] as const) {
      if (Math.hypot(x - origin.x, y - origin.y) <= radius) {
        addWithOffsets(Math.atan2(y - origin.y, x - origin.x));
      }
    }
    for (const angle of circleCrossingAngles(origin, radius, segment)) {
      addWithOffsets(angle);
    }
  }

  const sorted = angles.map(normalizeAngle).sort((a, b) => a - b);
  return sorted.filter((angle, i) => i === 0 || angle - sorted[i - 1] > Number.EPSILON);
}

function roundCoordinate(value: number): number {
  return Math.round(value * LOS_COORDINATE_PRECISION) / LOS_COORDINATE_PRECISION;
}

/** Drop repeated vertices, then vertices on a straight line between their neighbours (closed polygon). */
export function simplifyPolygon(points: readonly FogVertex[]): FogVertex[] {
  // Dedupe first: a duplicated corner would otherwise look "collinear" and both copies would go.
  const unique = points.filter((p, i) => {
    const prev = points[(i - 1 + points.length) % points.length];
    return points.length === 1 || p.x !== prev.x || p.y !== prev.y;
  });
  if (unique.length <= 3) return unique.length >= 3 ? unique : [...points];

  const result: FogVertex[] = [];
  const count = unique.length;
  for (let i = 0; i < count; i += 1) {
    const prev = unique[(i - 1 + count) % count];
    const current = unique[i];
    const next = unique[(i + 1) % count];
    const cross =
      (current.x - prev.x) * (next.y - prev.y) - (current.y - prev.y) * (next.x - prev.x);
    if (Math.abs(cross) > LOS_COLLINEAR_TOLERANCE) result.push(current);
  }
  return result.length >= 3 ? result : unique;
}

/**
 * Obstacle-aware visible area around `origin`, in ascending-angle order.
 * Callers should pre-filter `segments` (see SegmentGrid + cullSegmentsToCircle).
 */
export function computeVisibilityPolygon(
  origin: FogVertex,
  radius: number,
  segments: readonly LosSegment[],
): FogVertex[] {
  const points = collectRayAngles(origin, radius, segments).map((angle) => {
    const hit = castRay(origin, angle, radius, segments);
    return { x: roundCoordinate(hit.x), y: roundCoordinate(hit.y) };
  });
  return simplifyPolygon(points);
}

/**
 * Largest circle around `origin` that fits inside a visibility polygon. Visibility
 * polygons are star-shaped from their origin, so the nearest edge bounds it.
 */
export function inscribedRadius(origin: FogVertex, points: readonly FogVertex[]): number {
  let radius = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    radius = Math.min(
      radius,
      pointSegmentDistance(origin, { id: '', x1: a.x, y1: a.y, x2: b.x, y2: b.y }),
    );
  }
  return Number.isFinite(radius) ? radius : 0;
}

/** True when no blocking segment lies between `origin` and `target` within `radius`. */
export function hasLineOfSight(
  origin: FogVertex,
  target: FogVertex,
  radius: number,
  segments: readonly LosSegment[],
  ignoreSegmentId?: string,
): boolean {
  const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
  if (distance > radius) return false;
  if (distance === 0) return true;

  const dirX = (target.x - origin.x) / distance;
  const dirY = (target.y - origin.y) / distance;
  for (const segment of segments) {
    if (segment.id === ignoreSegmentId) continue;
    const t = raySegmentIntersection(origin, dirX, dirY, segment);
    if (t !== null && t < distance - LOS_TARGET_TOLERANCE) return false;
  }
  return true;
}

/** A door is visible when any sampled point along it has line of sight to the emitter. */
export function isSegmentVisible(
  origin: FogVertex,
  radius: number,
  target: LosSegment,
  segments: readonly LosSegment[],
): boolean {
  return DOOR_SAMPLE_FRACTIONS.some((f) =>
    hasLineOfSight(
      origin,
      { x: target.x1 + (target.x2 - target.x1) * f, y: target.y1 + (target.y2 - target.y1) * f },
      radius,
      segments,
      target.id,
    ),
  );
}

/**
 * Uniform-grid spatial index so each emitter only tests nearby obstacles
 * instead of scanning every wall on the scene.
 */
export class SegmentGrid {
  private readonly buckets = new Map<string, LosSegment[]>();
  private readonly oversized: LosSegment[] = [];
  private readonly bucketSize: number;

  constructor(segments: readonly LosSegment[], bucketSize: number) {
    this.bucketSize = Math.max(1, bucketSize);
    for (const segment of segments) this.insert(segment);
  }

  query(bounds: ObstacleBounds): LosSegment[] {
    const seen = new Set<LosSegment>(this.oversized);
    const [minBx, minBy] = this.bucketOf(bounds.minX, bounds.minY);
    const [maxBx, maxBy] = this.bucketOf(bounds.maxX, bounds.maxY);

    for (let bx = minBx; bx <= maxBx; bx += 1) {
      for (let by = minBy; by <= maxBy; by += 1) {
        for (const segment of this.buckets.get(`${bx},${by}`) ?? []) seen.add(segment);
      }
    }
    return [...seen];
  }

  private insert(segment: LosSegment): void {
    const [minBx, minBy] = this.bucketOf(
      Math.min(segment.x1, segment.x2),
      Math.min(segment.y1, segment.y2),
    );
    const [maxBx, maxBy] = this.bucketOf(
      Math.max(segment.x1, segment.x2),
      Math.max(segment.y1, segment.y2),
    );

    if ((maxBx - minBx + 1) * (maxBy - minBy + 1) > MAX_BUCKETS_PER_SEGMENT) {
      this.oversized.push(segment);
      return;
    }

    for (let bx = minBx; bx <= maxBx; bx += 1) {
      for (let by = minBy; by <= maxBy; by += 1) {
        const key = `${bx},${by}`;
        const bucket = this.buckets.get(key);
        if (bucket) bucket.push(segment);
        else this.buckets.set(key, [segment]);
      }
    }
  }

  private bucketOf(x: number, y: number): [number, number] {
    return [Math.floor(x / this.bucketSize), Math.floor(y / this.bucketSize)];
  }
}
