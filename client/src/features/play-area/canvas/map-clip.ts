import type { Container, Graphics } from 'pixi.js';

export interface MapClipBounds {
  width: number;
  height: number;
}

const CLIP_FILL_COLOR = 0xffffff;

/**
 * Clip `target` to the map rectangle using `mask`, or remove the clip when `bounds` is null.
 * `mask` must already be in the scene graph with the same world transform as the map origin.
 */
export function applyMapClip(target: Container, mask: Graphics, bounds: MapClipBounds | null): void {
  mask.clear();
  if (!bounds) {
    target.mask = null;
    return;
  }
  mask.rect(0, 0, bounds.width, bounds.height).fill(CLIP_FILL_COLOR);
  target.mask = mask;
}
