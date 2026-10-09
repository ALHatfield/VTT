import type {
    FogMaskConfig,
    FogVertex,
    FogVisibilityState,
    TokenVisionReveal,
    VisibilityPolygon,
    VisionStamp,
} from '@vtt/shared';
import {
    FOG_MASK_MAX_TEXTURE_DIMENSION,
    FOG_MASK_RESOLUTION_MAX,
    FOG_MASK_RESOLUTION_MIN,
    FOG_MASK_SOFT_EDGE_STEPS,
    FOG_MASK_STAMPS_PER_BATCH,
} from '@vtt/shared';

export interface MaskDimensions {
  /** Mask texture width in pixels. */
  width: number;
  /** Mask texture height in pixels. */
  height: number;
  /** Effective world-pixel → mask-pixel scale after clamping. */
  scale: number;
}

/**
 * Resolve the mask RenderTexture size for a map, honouring the requested
 * downscale factor while keeping both dimensions under the texture cap so large
 * maps cannot blow up GPU memory.
 */
export function computeMaskDimensions(
  mapWidth: number,
  mapHeight: number,
  requestedScale: number,
  maxDimension: number = FOG_MASK_MAX_TEXTURE_DIMENSION,
): MaskDimensions {
  if (mapWidth <= 0 || mapHeight <= 0) {
    return { width: 0, height: 0, scale: 0 };
  }

  const clampedRequest = Math.min(
    FOG_MASK_RESOLUTION_MAX,
    Math.max(FOG_MASK_RESOLUTION_MIN, requestedScale),
  );
  const capScale = maxDimension / Math.max(mapWidth, mapHeight);
  const scale = Math.min(clampedRequest, capScale);

  return {
    width: Math.max(1, Math.round(mapWidth * scale)),
    height: Math.max(1, Math.round(mapHeight * scale)),
    scale,
  };
}

/** Convert a world-space point into mask-texture space. */
export function worldToMask(point: FogVertex, scale: number): FogVertex {
  return { x: point.x * scale, y: point.y * scale };
}

/** Convert a mask-texture point back into world space. */
export function maskToWorld(point: FogVertex, scale: number): FogVertex {
  if (scale === 0) return { x: 0, y: 0 };
  return { x: point.x / scale, y: point.y / scale };
}

/**
 * Convert server vision reveals (grid coordinates + radius in cells) into
 * world-pixel stamps ready for mask composition.
 */
export function visionRevealsToStamps(
  reveals: TokenVisionReveal[],
  cellSize: number,
): VisionStamp[] {
  const stamps: VisionStamp[] = [];

  for (const reveal of reveals) {
    if (reveal.visionRadius <= 0) continue;
    stamps.push({
      id: reveal.tokenId,
      x: reveal.x * cellSize + cellSize / 2,
      y: reveal.y * cellSize + cellSize / 2,
      radius: reveal.visionRadius * cellSize,
    });
  }

  return stamps;
}

/**
 * Wall-ignoring peripheral circles, one per sighted reveal. Blind emitters
 * (visionRadius 0) get no peripheral sense either.
 */
export function buildPeripheralStamps(
  reveals: TokenVisionReveal[],
  radiusCells: number,
  cellSize: number,
): VisionStamp[] {
  if (radiusCells <= 0) return [];
  return visionRevealsToStamps(
    reveals
      .filter((reveal) => reveal.visionRadius > 0)
      .map((reveal) => ({ ...reveal, visionRadius: radiusCells })),
    cellSize,
  );
}

export interface ActiveVision {
  /** Circular reveals for emitters with no nearby obstacles. */
  stamps: VisionStamp[];
  /** Line-of-sight polygons (PM3) that replace the circle for obstructed emitters. */
  polygons: FogVertex[][];
}

/**
 * Split current reveals into LOS polygons and plain circles. Token polygons are
 * only used for emitters still in the reveal set, so a removed token never leaves
 * a stale polygon behind. Light polygons are lit areas and always apply.
 */
export function resolveActiveVision(
  reveals: TokenVisionReveal[],
  polygons: readonly VisibilityPolygon[],
  cellSize: number,
): ActiveVision {
  const polygonsByEmitter = new Map<string, FogVertex[]>();
  const activePolygons: FogVertex[][] = [];
  for (const polygon of polygons) {
    if (polygon.points.length < 3) continue;
    if (polygon.source === 'light') activePolygons.push(polygon.points);
    else polygonsByEmitter.set(polygon.emitterId, polygon.points);
  }

  const circleReveals: TokenVisionReveal[] = [];
  for (const reveal of reveals) {
    const points = polygonsByEmitter.get(reveal.tokenId);
    if (points && reveal.visionRadius > 0) activePolygons.push(points);
    else circleReveals.push(reveal);
  }

  return { stamps: visionRevealsToStamps(circleReveals, cellSize), polygons: activePolygons };
}

/**
 * Merge two stamp sets by id, keeping the larger radius when the same emitter
 * appears in both. Used to fold live vision into the persisted explored set.
 */
export function mergeVisionStamps(base: VisionStamp[], incoming: VisionStamp[]): VisionStamp[] {
  const byId = new Map<string, VisionStamp>();

  for (const stamp of [...base, ...incoming]) {
    const existing = byId.get(stamp.id);
    if (!existing || stamp.radius > existing.radius) {
      byId.set(stamp.id, stamp);
    }
  }

  return [...byId.values()];
}

/**
 * Split stamps into per-Graphics geometry batches. All batches are children of
 * one container and composed in a single render call.
 */
export function batchStamps(
  stamps: VisionStamp[],
  maxPerBatch: number = FOG_MASK_STAMPS_PER_BATCH,
): VisionStamp[][] {
  const size = Math.max(1, maxPerBatch);
  const batches: VisionStamp[][] = [];

  for (let i = 0; i < stamps.length; i += size) {
    batches.push(stamps.slice(i, i + size));
  }

  return batches;
}

export interface SoftEdgeRing {
  radius: number;
  alpha: number;
}

/**
 * Approximate a radial falloff with concentric filled circles drawn from the
 * outside in. The innermost ring is fully opaque; outer rings fade toward zero.
 */
export function buildSoftEdgeRings(
  radius: number,
  softnessRatio: number,
  steps: number = FOG_MASK_SOFT_EDGE_STEPS,
): SoftEdgeRing[] {
  const ratio = Math.min(1, Math.max(0, softnessRatio));
  const stepCount = Math.max(1, Math.round(steps));

  if (ratio === 0 || stepCount === 1) {
    return [{ radius, alpha: 1 }];
  }

  const innerRadius = radius * (1 - ratio);
  const rings: SoftEdgeRing[] = [];

  for (let i = stepCount; i >= 1; i -= 1) {
    const t = i / stepCount;
    rings.push({
      radius: innerRadius + (radius - innerRadius) * t,
      alpha: 1 / stepCount,
    });
  }

  rings.push({ radius: innerRadius, alpha: 1 });
  return rings;
}

/**
 * Determine the visibility state of a world point given the active and explored
 * stamp sets. Mirrors what the GPU composition produces, and is the reference
 * used by tests.
 */
export function resolveVisibilityState(
  point: FogVertex,
  activeStamps: VisionStamp[],
  exploredStamps: VisionStamp[],
): FogVisibilityState {
  if (isPointCovered(point, activeStamps)) return 'active';
  if (isPointCovered(point, exploredStamps)) return 'explored';
  return 'hidden';
}

function isPointCovered(point: FogVertex, stamps: VisionStamp[]): boolean {
  for (const stamp of stamps) {
    const dx = point.x - stamp.x;
    const dy = point.y - stamp.y;
    if (dx * dx + dy * dy <= stamp.radius * stamp.radius) return true;
  }
  return false;
}

/**
 * The explored mask must always include currently active vision, otherwise the
 * hidden layer would darken areas the party can see right now.
 */
export function resolveExploredStamps(
  config: FogMaskConfig,
  activeStamps: VisionStamp[],
  persistedStamps: VisionStamp[],
): VisionStamp[] {
  if (config.explorationMode === 'off') return activeStamps;
  return mergeVisionStamps(persistedStamps, activeStamps);
}
