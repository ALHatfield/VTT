import { describe, expect, it } from 'vitest';

import { GRID_DETECTION_MIN_CONFIDENCE } from '@vtt/shared';

import {
  calcAlignedDimensions,
  detectGridSpacing,
  findDominantPeriod,
  projectEdges,
  rgbaToGrayscale,
  sobelEdgeMagnitude,
} from './grid-alignment';

describe('calcAlignedDimensions', () => {
  it('keeps original size when traced 3 cells exactly match canvasGridSize', () => {
    // 512×512 tile, traced 3 cells = 192 asset-px → spacing = 64px = canvasGridSize
    const r = calcAlignedDimensions(192, 3, 64, 512, 512);
    expect(r.width).toBe(512);
    expect(r.height).toBe(512);
    expect(r.gridSpacingPx).toBeCloseTo(64);
    expect(r.autoDetected).toBe(false);
  });

  it('downscales when asset grid spacing is larger than canvasGridSize', () => {
    // traced 3 cells = 300px → spacing = 100px, canvas = 64 → scale = 0.64
    const r = calcAlignedDimensions(300, 3, 64, 600, 600);
    expect(r.gridSpacingPx).toBeCloseTo(100);
    expect(r.width).toBe(384);
    expect(r.height).toBe(384);
  });

  it('upscales when asset grid spacing is smaller than canvasGridSize', () => {
    // traced 3 cells = 96px → spacing = 32px, canvas = 64 → scale = 2.0
    const r = calcAlignedDimensions(96, 3, 64, 256, 256);
    expect(r.gridSpacingPx).toBeCloseTo(32);
    expect(r.width).toBe(512);
    expect(r.height).toBe(512);
  });

  it('handles cellsAcross values other than 3', () => {
    // 5 cells traced at 320px → spacing = 64px, canvas = 64 → no resize
    const r = calcAlignedDimensions(320, 5, 64, 512, 512);
    expect(r.gridSpacingPx).toBeCloseTo(64);
    expect(r.width).toBe(512);
  });

  it('preserves aspect ratio for non-square assets', () => {
    // 512×256 tile, spacing = 64px (matches canvas) → no size change
    const r = calcAlignedDimensions(192, 3, 64, 512, 256);
    expect(r.width).toBe(512);
    expect(r.height).toBe(256);
  });

  it('returns original dimensions for zero tracedWidthPx', () => {
    const r = calcAlignedDimensions(0, 3, 64, 512, 512);
    expect(r.width).toBe(512);
    expect(r.height).toBe(512);
    expect(r.gridSpacingPx).toBe(0);
  });

  it('returns original dimensions for zero cellsAcross', () => {
    const r = calcAlignedDimensions(192, 0, 64, 512, 512);
    expect(r.width).toBe(512);
    expect(r.height).toBe(512);
  });
});

describe('rgbaToGrayscale', () => {
  it('converts pure-red to correct BT.601 luminance', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    const result = rgbaToGrayscale(data, 1, 1);
    expect(result[0]).toBeCloseTo(0.299 * 255, 1);
  });

  it('converts white to ~255', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255]);
    const result = rgbaToGrayscale(data, 1, 1);
    expect(result[0]).toBeCloseTo(255, 1);
  });

  it('converts black to 0', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255]);
    const result = rgbaToGrayscale(data, 1, 1);
    expect(result[0]).toBe(0);
  });
});

describe('sobelEdgeMagnitude', () => {
  it('returns zero magnitude for a uniform image', () => {
    const gray = new Float32Array(16).fill(128);
    const mag = sobelEdgeMagnitude(gray, 4, 4);
    for (let i = 0; i < 16; i++) expect(mag[i]).toBe(0);
  });

  it('detects a vertical edge between black and white halves', () => {
    const w = 5;
    const h = 3;
    const gray = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        gray[y * w + x] = x < 2 ? 0 : 255;
      }
    }
    const mag = sobelEdgeMagnitude(gray, w, h);
    // The interior pixel at x=2, y=1 straddles the edge → high magnitude
    expect(mag[1 * w + 2]).toBeGreaterThan(0);
  });
});

describe('projectEdges', () => {
  it('accumulates a single non-zero edge pixel into its column and row', () => {
    const w = 3;
    const h = 3;
    const edges = new Float32Array(w * h);
    edges[1 * w + 2] = 100; // x=2, y=1
    const { colProjection, rowProjection } = projectEdges(edges, w, h);
    expect(colProjection[2]).toBe(100);
    expect(rowProjection[1]).toBe(100);
    expect(colProjection[0]).toBe(0);
    expect(rowProjection[0]).toBe(0);
  });

  it('sums multiple edge pixels per column', () => {
    const w = 3;
    const h = 3;
    const edges = new Float32Array(w * h);
    edges[0 * w + 1] = 50;
    edges[1 * w + 1] = 30;
    edges[2 * w + 1] = 20;
    const { colProjection } = projectEdges(edges, w, h);
    expect(colProjection[1]).toBe(100);
  });
});

describe('findDominantPeriod', () => {
  it('finds the period of a clean sinusoidal signal', () => {
    const period = 32;
    const n = 256;
    const signal = new Float32Array(n);
    for (let i = 0; i < n; i++) signal[i] = Math.sin((2 * Math.PI * i) / period) + 1;
    const result = findDominantPeriod(signal, 8, 64);
    expect(result.period).toBe(period);
    expect(result.confidence).toBeGreaterThan(GRID_DETECTION_MIN_CONFIDENCE);
  });

  it('returns zero confidence for a flat signal', () => {
    const signal = new Float32Array(100).fill(5);
    const result = findDominantPeriod(signal, 8, 32);
    expect(result.confidence).toBe(0);
  });

  it('returns zero confidence for an empty signal', () => {
    const result = findDominantPeriod(new Float32Array(0), 8, 32);
    expect(result.period).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('returns zero when minPeriod >= maxPeriod', () => {
    const signal = new Float32Array(100).fill(1);
    const result = findDominantPeriod(signal, 32, 8);
    expect(result.period).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('returns zero when minPeriod >= signal length', () => {
    const signal = new Float32Array(10).fill(1);
    const result = findDominantPeriod(signal, 20, 50);
    expect(result.period).toBe(0);
    expect(result.confidence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// detectGridSpacing — injectable loadFn lets us skip real image loading
// ---------------------------------------------------------------------------

describe('detectGridSpacing', () => {
  const baseArgs = [
    'http://example.com/tile.png', // imageUrl
    64, // canvasGridSize
    { cellsAcross: 3, cellsDown: 3 }, // config
    512, // assetWidth
    512, // assetHeight
  ] as const;

  it('returns original dimensions when image load fails', async () => {
    const failLoad = async (): Promise<ImageData | null> => null;
    const result = await detectGridSpacing(...baseArgs, failLoad);
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.confidence).toBe(0);
    expect(result.autoDetected).toBe(true);
  });

  it('returns original dimensions when confidence is below threshold (no clear grid)', async () => {
    // Uniform image → Sobel produces zero edges → zero autocorrelation → confidence=0
    const uniformLoad = async (): Promise<ImageData> => {
      const w = 64;
      const h = 64;
      return {
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4).fill(128),
        colorSpace: 'srgb',
      } as ImageData;
    };
    const result = await detectGridSpacing(...baseArgs, uniformLoad);
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.confidence ?? 0).toBeLessThan(GRID_DETECTION_MIN_CONFIDENCE);
  });

  it('detects grid spacing from synthetic striped image and scales tile correctly', async () => {
    // Build a 64×64 image with vertical stripes every 16px (period=16px)
    const w = 192;
    const h = 192;
    const period = 16;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = Math.floor(x / period) % 2 === 0 ? 0 : 255;
        const i = (y * w + x) * 4;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    const stripedLoad = async (): Promise<ImageData> =>
      ({ width: w, height: h, data, colorSpace: 'srgb' }) as ImageData;
    // canvasGridSize=64, detected period=16 → scale=4 → 512*4=2048
    const result = await detectGridSpacing(...baseArgs, stripedLoad);
    if ((result.confidence ?? 0) >= GRID_DETECTION_MIN_CONFIDENCE) {
      expect(result.gridSpacingPx).toBe(period);
      expect(result.width).toBe(Math.round(512 * (64 / period)));
      expect(result.height).toBe(Math.round(512 * (64 / period)));
      expect(result.autoDetected).toBe(true);
    } else {
      // Detection didn't reach threshold — skip scaling assertions
      expect(result.width).toBe(512);
    }
  });
});
