import { describe, expect, it } from 'vitest';
import {
  gridToPixel,
  pixelToGrid,
  snapToGrid,
  snapToGridCenter,
  snappedPixelToGridCoords,
} from './grid-utils';

describe('pixelToGrid', () => {
  it('converts pixel position to grid column/row', () => {
    expect(pixelToGrid(0, 0, 64)).toEqual({ gridX: 0, gridY: 0 });
    expect(pixelToGrid(64, 64, 64)).toEqual({ gridX: 1, gridY: 1 });
    expect(pixelToGrid(128, 192, 64)).toEqual({ gridX: 2, gridY: 3 });
  });

  it('floors partial cell positions', () => {
    expect(pixelToGrid(32, 32, 64)).toEqual({ gridX: 0, gridY: 0 });
    expect(pixelToGrid(65, 127, 64)).toEqual({ gridX: 1, gridY: 1 });
  });
});

describe('gridToPixel', () => {
  it('converts grid coordinates to pixel top-left position', () => {
    expect(gridToPixel(0, 0, 64)).toEqual({ pixelX: 0, pixelY: 0 });
    expect(gridToPixel(1, 2, 64)).toEqual({ pixelX: 64, pixelY: 128 });
    expect(gridToPixel(3, 3, 32)).toEqual({ pixelX: 96, pixelY: 96 });
  });
});

describe('snapToGrid', () => {
  it('snaps to top-left of nearest grid cell', () => {
    expect(snapToGrid(0, 0, 64)).toEqual({ x: 0, y: 0 });
    expect(snapToGrid(64, 64, 64)).toEqual({ x: 64, y: 64 });
    expect(snapToGrid(96, 96, 64)).toEqual({ x: 128, y: 128 }); // rounds up (0.5+)
    expect(snapToGrid(32, 32, 64)).toEqual({ x: 64, y: 64 }); // rounds up (0.5 → nearest even)
  });

  it('never returns negative values', () => {
    expect(snapToGrid(-10, -10, 64)).toEqual({ x: 0, y: 0 });
  });

  it('works with different cell sizes', () => {
    expect(snapToGrid(48, 48, 32)).toEqual({ x: 64, y: 64 }); // nearest is 2 cells (64)
    expect(snapToGrid(16, 16, 32)).toEqual({ x: 32, y: 32 }); // nearest is 1 cell (32)
  });
});

describe('snappedPixelToGridCoords', () => {
  it('converts aligned pixel positions to grid coords', () => {
    expect(snappedPixelToGridCoords(0, 0, 64)).toEqual({ gridX: 0, gridY: 0 });
    expect(snappedPixelToGridCoords(128, 192, 64)).toEqual({ gridX: 2, gridY: 3 });
    expect(snappedPixelToGridCoords(64, 64, 64)).toEqual({ gridX: 1, gridY: 1 });
  });

  it('never returns negative coordinates', () => {
    expect(snappedPixelToGridCoords(-64, -64, 64)).toEqual({ gridX: 0, gridY: 0 });
  });
});

describe('snapToGridCenter', () => {
  it('snaps to the center of the containing grid cell', () => {
    // Top-left of cell 0,0 → center is 32,32
    expect(snapToGridCenter(0, 0, 64)).toEqual({ x: 32, y: 32 });
    // Exactly at cell center → same cell
    expect(snapToGridCenter(32, 32, 64)).toEqual({ x: 32, y: 32 });
    // Cell 1,0 (64–127) → center at 96
    expect(snapToGridCenter(64, 0, 64)).toEqual({ x: 96, y: 32 });
    // Cell 1,1 (64–127 on both axes) → center at 96,96
    expect(snapToGridCenter(96, 80, 64)).toEqual({ x: 96, y: 96 });
  });

  it('works with non-power-of-two cell sizes', () => {
    expect(snapToGridCenter(0, 0, 70)).toEqual({ x: 35, y: 35 });
    expect(snapToGridCenter(70, 0, 70)).toEqual({ x: 105, y: 35 });
  });

  it('returns correct center for positions just before cell boundary', () => {
    expect(snapToGridCenter(63, 63, 64)).toEqual({ x: 32, y: 32 });
  });
});
