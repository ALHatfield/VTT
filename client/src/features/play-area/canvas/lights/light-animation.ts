// Deterministic light animation — Phase PM4
// Pure functions of (mode, seed, time). Driven by wall-clock time, so every client
// animates a light in phase without any server ticking.
import type { LightAnimationMode } from '@vtt/shared';

export const FLICKER_MIN = 0.72;
export const FLICKER_MAX = 1;
export const PULSE_MIN = 0.6;
export const PULSE_MAX = 1;

/** Layered sine octaves: angular frequency (rad/ms) and weight. Weights sum to 1. */
const FLICKER_OCTAVES = [
  { frequency: 0.0021, weight: 0.45 },
  { frequency: 0.0067, weight: 0.3 },
  { frequency: 0.0173, weight: 0.25 },
] as const;
const FLICKER_NOISE_WEIGHT = 0.35;
/** Value-noise lattice spacing in ms — how often the random target changes. */
const FLICKER_NOISE_STEP_MS = 90;
const PULSE_FREQUENCY = 0.0015;
const TWO_PI = Math.PI * 2;

/** Integer hash → [0, 1). Mulberry32-style avalanche so adjacent inputs decorrelate. */
export function hash01(n: number): number {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Smoothly interpolated 1D value noise in [-1, 1]. */
function valueNoise(seed: number, timeMs: number): number {
  const pos = timeMs / FLICKER_NOISE_STEP_MS;
  const i = Math.floor(pos);
  const f = pos - i;
  const smooth = f * f * (3 - 2 * f);
  const a = hash01(seed ^ i);
  const b = hash01(seed ^ (i + 1));
  return (a + (b - a) * smooth) * 2 - 1;
}

/** Raw flicker signal in [-1, 1]. */
function flickerSignal(seed: number, timeMs: number): number {
  let sum = 0;
  FLICKER_OCTAVES.forEach(({ frequency, weight }, octave) => {
    const phase = hash01(seed + octave) * TWO_PI;
    sum += Math.sin(timeMs * frequency + phase) * weight;
  });
  const mixed = sum * (1 - FLICKER_NOISE_WEIGHT) + valueNoise(seed, timeMs) * FLICKER_NOISE_WEIGHT;
  return Math.max(-1, Math.min(1, mixed));
}

function mapToRange(signal: number, min: number, max: number): number {
  return min + ((signal + 1) / 2) * (max - min);
}

/**
 * Brightness multiplier for a light at `timeMs`. Always within the mode's
 * [MIN, MAX] bounds; `none` (or reduced motion upstream) returns 1.
 */
export function lightAnimationFactor(
  mode: LightAnimationMode,
  seed: number,
  timeMs: number,
): number {
  switch (mode) {
    case 'flicker':
      return mapToRange(flickerSignal(seed, timeMs), FLICKER_MIN, FLICKER_MAX);
    case 'pulse': {
      const phase = hash01(seed) * TWO_PI;
      return mapToRange(Math.sin(timeMs * PULSE_FREQUENCY + phase), PULSE_MIN, PULSE_MAX);
    }
    case 'none':
      return 1;
  }
}

/** Parse "#rrggbb" into a PixiJS numeric color. */
export function hexColorToNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}
