import type { ViewportBounds } from '@vtt/shared';

/**
 * Determines whether a rectangular sprite overlaps the visible viewport.
 * All coordinates are in world space.
 */
export function isInViewport(
  spriteX: number,
  spriteY: number,
  spriteWidth: number,
  spriteHeight: number,
  viewport: ViewportBounds,
): boolean {
  return (
    spriteX + spriteWidth > viewport.x &&
    spriteX < viewport.x + viewport.width &&
    spriteY + spriteHeight > viewport.y &&
    spriteY < viewport.y + viewport.height
  );
}

/**
 * Converts screen coordinates to world coordinates, accounting for pan and zoom.
 * Reserved for use in Phase 4B+ (token placement, click-to-select).
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  };
}

/**
 * Computes the visible world area from the current pan offset and zoom level.
 */
export function getViewportBounds(
  screenWidth: number,
  screenHeight: number,
  panX: number,
  panY: number,
  zoom: number,
): ViewportBounds {
  return {
    x: -panX / zoom,
    y: -panY / zoom,
    width: screenWidth / zoom,
    height: screenHeight / zoom,
  };
}
