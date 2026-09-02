import type { GridAlignmentResult, GridDetectionConfig } from '@vtt/shared';
import { GRID_DETECTION_MIN_CONFIDENCE, GRID_DETECTION_TIMEOUT_MS } from '@vtt/shared';

/** Minimum grid-cell size (px) that the auto-detector will consider. */
const GRID_DETECT_MIN_PERIOD_PX = 8;

/**
 * Calculate new tile dimensions so that one traced grid cell matches canvasGridSize.
 * Resizes the tile asset — never the canvas.
 */
export function calcAlignedDimensions(
  tracedWidthPx: number,
  cellsAcross: number,
  canvasGridSize: number,
  assetWidth: number,
  assetHeight: number,
): GridAlignmentResult {
  if (tracedWidthPx <= 0 || cellsAcross <= 0) {
    return { width: assetWidth, height: assetHeight, gridSpacingPx: 0, autoDetected: false };
  }
  const gridSpacingPx = tracedWidthPx / cellsAcross;
  const scale = canvasGridSize / gridSpacingPx;
  return {
    width: Math.round(assetWidth * scale),
    height: Math.round(assetHeight * scale),
    gridSpacingPx,
    autoDetected: false,
  };
}

/** Convert RGBA pixel buffer to grayscale luminance (ITU-R BT.601 coefficients). */
export function rgbaToGrayscale(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return gray;
}

/** Apply Sobel 3×3 kernel and return per-pixel edge magnitude. */
export function sobelEdgeMagnitude(
  gray: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = gray[(y - 1) * width + (x - 1)];
      const tc = gray[(y - 1) * width + x];
      const tr = gray[(y - 1) * width + (x + 1)];
      const ml = gray[y * width + (x - 1)];
      const mr = gray[y * width + (x + 1)];
      const bl = gray[(y + 1) * width + (x - 1)];
      const bc = gray[(y + 1) * width + x];
      const br = gray[(y + 1) * width + (x + 1)];
      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = tl + 2 * tc + tr - bl - 2 * bc - br;
      mag[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return mag;
}

/** Sum edge magnitudes per column and per row to produce 1-D projections. */
export function projectEdges(
  edges: Float32Array,
  width: number,
  height: number,
): { colProjection: Float32Array; rowProjection: Float32Array } {
  const colProjection = new Float32Array(width);
  const rowProjection = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = edges[y * width + x];
      colProjection[x] += v;
      rowProjection[y] += v;
    }
  }
  return { colProjection, rowProjection };
}

/**
 * Find the dominant period in a 1-D signal using normalized autocorrelation.
 * Returns confidence 0–1; < GRID_DETECTION_MIN_CONFIDENCE means no reliable grid found.
 */
export function findDominantPeriod(
  signal: Float32Array,
  minPeriod: number,
  maxPeriod: number,
): { period: number; confidence: number } {
  const n = signal.length;
  if (n === 0 || minPeriod >= maxPeriod || minPeriod >= n) {
    return { period: 0, confidence: 0 };
  }

  let mean = 0;
  for (let i = 0; i < n; i++) mean += signal[i];
  mean /= n;

  const norm = new Float32Array(n);
  let r0 = 0;
  for (let i = 0; i < n; i++) {
    norm[i] = signal[i] - mean;
    r0 += norm[i] * norm[i];
  }
  if (r0 === 0) return { period: 0, confidence: 0 };

  let bestPeriod = minPeriod;
  let bestCorr = -Infinity;
  const clampedMax = Math.min(maxPeriod, n - 1);
  for (let lag = minPeriod; lag <= clampedMax; lag++) {
    let corr = 0;
    for (let i = 0; i < n - lag; i++) corr += norm[i] * norm[i + lag];
    corr /= r0;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestPeriod = lag;
    }
  }

  return { period: bestPeriod, confidence: Math.max(0, bestCorr) };
}

/** Load an image URL into an HTMLCanvasElement and return its ImageData, or null on failure. */
async function loadImageData(imageUrl: string): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = (): void => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight));
    };
    img.onerror = (): void => resolve(null);
    img.src = imageUrl;
  });
}

/**
 * Auto-detect grid spacing via Sobel edge detection + autocorrelation.
 * Returns a result with confidence < GRID_DETECTION_MIN_CONFIDENCE when detection fails.
 * Never throws — undetectable grids and load failures return low-confidence results.
 *
 * @param loadFn Injectable image loader; defaults to browser canvas-based loader.
 *               Override in tests to avoid real image loading.
 */
export async function detectGridSpacing(
  imageUrl: string,
  canvasGridSize: number,
  config: GridDetectionConfig,
  assetWidth: number,
  assetHeight: number,
  loadFn: (url: string) => Promise<ImageData | null> = loadImageData,
): Promise<GridAlignmentResult> {
  const failure: GridAlignmentResult = {
    width: assetWidth,
    height: assetHeight,
    gridSpacingPx: 0,
    confidence: 0,
    autoDetected: true,
  };

  let timer!: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<GridAlignmentResult>((resolve) => {
    timer = setTimeout(() => resolve(failure), GRID_DETECTION_TIMEOUT_MS);
  });

  const detectionPromise = (async (): Promise<GridAlignmentResult> => {
    const imageData = await loadFn(imageUrl);
    if (!imageData) return failure;

    const { width, height, data } = imageData;
    const gray = rgbaToGrayscale(data, width, height);
    const edges = sobelEdgeMagnitude(gray, width, height);
    const { colProjection, rowProjection } = projectEdges(edges, width, height);

    // Use config to constrain the search range:
    // The period can't exceed the image dimension divided by the number of
    // expected cells — that would mean fewer cells than the user specified.
    const minPeriod = GRID_DETECT_MIN_PERIOD_PX;
    const maxPeriod = Math.min(
      Math.floor(width / config.cellsAcross),
      Math.floor(height / config.cellsDown),
    );
    if (minPeriod >= maxPeriod) return failure;

    const colResult = findDominantPeriod(colProjection, minPeriod, maxPeriod);
    const rowResult = findDominantPeriod(rowProjection, minPeriod, maxPeriod);
    const best = colResult.confidence >= rowResult.confidence ? colResult : rowResult;

    if (best.confidence < GRID_DETECTION_MIN_CONFIDENCE) {
      return { ...failure, gridSpacingPx: best.period, confidence: best.confidence };
    }

    const scale = canvasGridSize / best.period;
    return {
      width: Math.round(assetWidth * scale),
      height: Math.round(assetHeight * scale),
      gridSpacingPx: best.period,
      confidence: best.confidence,
      autoDetected: true,
    };
  })();

  const result = await Promise.race([detectionPromise, timeoutPromise]);
  clearTimeout(timer);
  return result;
}
