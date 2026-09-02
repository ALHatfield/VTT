/**
 * Convert pixel coordinates to grid cell coordinates (0-indexed).
 * Floors to the current cell.
 */
export function pixelToGrid(
  pixelX: number,
  pixelY: number,
  cellSize: number,
): { gridX: number; gridY: number } {
  return {
    gridX: Math.floor(pixelX / cellSize),
    gridY: Math.floor(pixelY / cellSize),
  };
}

/**
 * Convert grid cell coordinates to the pixel position of the cell's top-left corner.
 */
export function gridToPixel(
  gridX: number,
  gridY: number,
  cellSize: number,
): { pixelX: number; pixelY: number } {
  return {
    pixelX: gridX * cellSize,
    pixelY: gridY * cellSize,
  };
}

/**
 * Snap pixel coordinates to the nearest grid cell boundary.
 * Returns the pixel position of the nearest grid cell's top-left corner.
 */
export function snapToGrid(
  pixelX: number,
  pixelY: number,
  cellSize: number,
): { x: number; y: number } {
  const gridX = Math.round(pixelX / cellSize);
  const gridY = Math.round(pixelY / cellSize);
  return {
    x: Math.max(0, gridX) * cellSize,
    y: Math.max(0, gridY) * cellSize,
  };
}

/**
 * Convert snapped pixel coordinates to grid column/row indices.
 * Assumes the pixel position is already grid-aligned (i.e. from snapToGrid).
 */
export function snappedPixelToGridCoords(
  pixelX: number,
  pixelY: number,
  cellSize: number,
): { gridX: number; gridY: number } {
  return {
    gridX: Math.max(0, Math.round(pixelX / cellSize)),
    gridY: Math.max(0, Math.round(pixelY / cellSize)),
  };
}

/**
 * Snap pixel coordinates to the center of the nearest grid cell.
 * Used by the measure tool for start/end point snapping.
 */
export function snapToGridCenter(
  pixelX: number,
  pixelY: number,
  cellSize: number,
): { x: number; y: number } {
  const gridX = Math.floor(pixelX / cellSize);
  const gridY = Math.floor(pixelY / cellSize);
  return {
    x: gridX * cellSize + cellSize / 2,
    y: gridY * cellSize + cellSize / 2,
  };
}
