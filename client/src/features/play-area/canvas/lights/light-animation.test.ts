import { describe, expect, it } from 'vitest';

import {
    FLICKER_MAX,
    FLICKER_MIN,
    PULSE_MAX,
    PULSE_MIN,
    hexColorToNumber,
    lightAnimationFactor,
} from './light-animation';

const SAMPLE_COUNT = 5000;
const SAMPLE_STEP_MS = 16.7;
const PER_FRAME_BUDGET_MS = 3;
const BUDGET_LIGHT_COUNT = 50;
const BUDGET_FRAMES = 60;

describe('lightAnimationFactor', () => {
  it('is deterministic for the same seed and time', () => {
    for (let t = 0; t < 10_000; t += 333) {
      expect(lightAnimationFactor('flicker', 42, t)).toBe(lightAnimationFactor('flicker', 42, t));
      expect(lightAnimationFactor('pulse', 42, t)).toBe(lightAnimationFactor('pulse', 42, t));
    }
  });

  it('differs between seeds so lights do not flicker in lockstep', () => {
    const a = lightAnimationFactor('flicker', 1, 1234);
    const b = lightAnimationFactor('flicker', 2, 1234);
    expect(a).not.toBe(b);
  });

  it.each([
    ['flicker', FLICKER_MIN, FLICKER_MAX],
    ['pulse', PULSE_MIN, PULSE_MAX],
  ] as const)('%s stays within its bounds', (mode, min, max) => {
    for (const seed of [0, 7, 123_456, 2_147_483_646]) {
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const f = lightAnimationFactor(mode, seed, i * SAMPLE_STEP_MS);
        expect(f).toBeGreaterThanOrEqual(min);
        expect(f).toBeLessThanOrEqual(max);
      }
    }
  });

  it('flicker actually varies over time', () => {
    const values = new Set<number>();
    for (let i = 0; i < 100; i++) values.add(lightAnimationFactor('flicker', 9, i * 50));
    expect(values.size).toBeGreaterThan(50);
  });

  it('returns 1 for non-animated lights', () => {
    expect(lightAnimationFactor('none', 5, 999)).toBe(1);
  });

  it(`computes ${BUDGET_LIGHT_COUNT} lights well under the ${PER_FRAME_BUDGET_MS} ms frame budget`, () => {
    const start = performance.now();
    for (let frame = 0; frame < BUDGET_FRAMES; frame++) {
      for (let seed = 0; seed < BUDGET_LIGHT_COUNT; seed++) {
        lightAnimationFactor('flicker', seed, frame * SAMPLE_STEP_MS);
      }
    }
    const perFrame = (performance.now() - start) / BUDGET_FRAMES;
    expect(perFrame).toBeLessThan(PER_FRAME_BUDGET_MS);
  });
});

describe('hexColorToNumber', () => {
  it('parses 6-digit hex', () => {
    expect(hexColorToNumber('#ff9a3c')).toBe(0xff9a3c);
  });
});
