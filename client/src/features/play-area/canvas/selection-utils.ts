// selection-utils — Phase 5B (multi-select / marquee)
//
// Pure geometry helpers used by CanvasManager when computing which tile
// placements intersect a rubber-band marquee rectangle. All coordinates are in
// world space; the helpers do not know about PixiJS.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Returns true when two axis-aligned rectangles overlap.
 * Rectangles that share only an edge are treated as non-overlapping.
 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x + a.width > b.x && a.x < b.x + b.width && a.y + a.height > b.y && a.y < b.y + b.height;
}

/**
 * Normalize two arbitrary corner points into an axis-aligned rectangle with
 * non-negative width/height.
 */
export function rectFromPoints(ax: number, ay: number, bx: number, by: number): Rect {
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  return {
    x,
    y,
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  };
}
