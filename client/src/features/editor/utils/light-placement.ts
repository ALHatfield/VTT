// Light placement helpers — Phase 5G
import type { LightEmitterType } from '@vtt/shared';
import { LIGHT_EMITTER_TYPES } from '@vtt/shared';

/** Drag data MIME type set by the lights palette on dragstart; payload is the emitter type. */
export const LIGHT_DRAG_MIME = 'application/vtt-light-preset';

export interface LightPoint {
  x: number;
  y: number;
}

/** Returns the emitter type carried by a palette drag, or null for foreign payloads. */
export function parseLightPresetDrag(data: string): LightEmitterType | null {
  return (LIGHT_EMITTER_TYPES as readonly string[]).includes(data)
    ? (data as LightEmitterType)
    : null;
}

/** Snap to the half-cell lattice (cell centres, edge midpoints, corners) unless bypassed. */
export function snapLightPoint(point: LightPoint, cellSize: number, bypass: boolean): LightPoint {
  if (bypass || cellSize <= 0) return point;
  const step = cellSize / 2;
  return { x: Math.round(point.x / step) * step, y: Math.round(point.y / step) * step };
}

/** The light whose marker is nearest `point` within `hitRadius`, or null. */
export function findLightAt<T extends LightPoint>(
  lights: readonly T[],
  point: LightPoint,
  hitRadius: number,
): T | null {
  let nearest: T | null = null;
  let nearestDistance = hitRadius;
  for (const light of lights) {
    const distance = Math.hypot(light.x - point.x, light.y - point.y);
    if (distance <= nearestDistance) {
      nearest = light;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** Convert a `#rrggbb` string to a Pixi-compatible numeric colour. */
export function hexToNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}
