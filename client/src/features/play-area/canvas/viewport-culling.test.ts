import { describe, expect, it } from 'vitest';

import { getViewportBounds, isInViewport, screenToWorld } from './viewport-culling';

describe('isInViewport', () => {
  const viewport = { x: 100, y: 100, width: 800, height: 600 };

  it('returns true when sprite is fully inside the viewport', () => {
    expect(isInViewport(200, 200, 100, 100, viewport)).toBe(true);
  });

  it('returns true when sprite overlaps the left edge', () => {
    expect(isInViewport(50, 200, 100, 100, viewport)).toBe(true);
  });

  it('returns true when sprite overlaps the right edge', () => {
    expect(isInViewport(850, 200, 100, 100, viewport)).toBe(true);
  });

  it('returns true when sprite overlaps the top edge', () => {
    expect(isInViewport(200, 50, 100, 100, viewport)).toBe(true);
  });

  it('returns true when sprite overlaps the bottom edge', () => {
    expect(isInViewport(200, 650, 100, 100, viewport)).toBe(true);
  });

  it('returns false when sprite is entirely to the left', () => {
    expect(isInViewport(0, 200, 50, 50, viewport)).toBe(false);
  });

  it('returns false when sprite is entirely to the right', () => {
    expect(isInViewport(950, 200, 50, 50, viewport)).toBe(false);
  });

  it('returns false when sprite is entirely above', () => {
    expect(isInViewport(200, 0, 50, 50, viewport)).toBe(false);
  });

  it('returns false when sprite is entirely below', () => {
    expect(isInViewport(200, 750, 50, 50, viewport)).toBe(false);
  });

  it('returns true when sprite is larger than the viewport and covers it', () => {
    expect(isInViewport(50, 50, 1000, 800, viewport)).toBe(true);
  });
});

describe('screenToWorld', () => {
  it('converts screen coords at no pan, zoom=1', () => {
    const result = screenToWorld(400, 300, 0, 0, 1);
    expect(result).toEqual({ x: 400, y: 300 });
  });

  it('accounts for pan offset', () => {
    const result = screenToWorld(400, 300, 100, 50, 1);
    expect(result).toEqual({ x: 300, y: 250 });
  });

  it('accounts for zoom', () => {
    const result = screenToWorld(400, 300, 0, 0, 2);
    expect(result).toEqual({ x: 200, y: 150 });
  });

  it('accounts for both pan and zoom', () => {
    const result = screenToWorld(400, 300, 100, 50, 2);
    expect(result).toEqual({ x: 150, y: 125 });
  });
});

describe('getViewportBounds', () => {
  it('returns full screen bounds at no pan, zoom=1', () => {
    const bounds = getViewportBounds(800, 600, 0, 0, 1);
    expect(bounds.x).toBeCloseTo(0);
    expect(bounds.y).toBeCloseTo(0);
    expect(bounds.width).toBe(800);
    expect(bounds.height).toBe(600);
  });

  it('expands visible area when zoomed out', () => {
    const bounds = getViewportBounds(800, 600, 0, 0, 0.5);
    expect(bounds.x).toBeCloseTo(0);
    expect(bounds.y).toBeCloseTo(0);
    expect(bounds.width).toBe(1600);
    expect(bounds.height).toBe(1200);
  });

  it('shrinks visible area when zoomed in', () => {
    const bounds = getViewportBounds(800, 600, 0, 0, 2);
    expect(bounds.x).toBeCloseTo(0);
    expect(bounds.y).toBeCloseTo(0);
    expect(bounds.width).toBe(400);
    expect(bounds.height).toBe(300);
  });

  it('shifts origin when panned', () => {
    const bounds = getViewportBounds(800, 600, -200, -100, 1);
    expect(bounds).toEqual({ x: 200, y: 100, width: 800, height: 600 });
  });

  it('accounts for both pan and zoom', () => {
    const bounds = getViewportBounds(800, 600, -400, -200, 2);
    expect(bounds).toEqual({ x: 200, y: 100, width: 400, height: 300 });
  });
});
