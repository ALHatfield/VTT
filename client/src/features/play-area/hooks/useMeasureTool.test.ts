import { describe, expect, it } from 'vitest';
import { calcMeasureDistance, formatMeasureLabel } from './useMeasureTool';

describe('calcMeasureDistance', () => {
  const CELL = 64;

  it('returns 0 for same start and end point', () => {
    expect(calcMeasureDistance(0, 0, 0, 0, CELL)).toBe(0);
  });

  it('calculates horizontal distance correctly', () => {
    // 3 cells apart horizontally
    const dist = calcMeasureDistance(32, 32, 32 + 3 * CELL, 32, CELL);
    expect(dist).toBeCloseTo(3, 5);
  });

  it('calculates vertical distance correctly', () => {
    // 4 cells apart vertically
    const dist = calcMeasureDistance(32, 32, 32, 32 + 4 * CELL, CELL);
    expect(dist).toBeCloseTo(4, 5);
  });

  it('calculates diagonal distance correctly (Pythagorean)', () => {
    // 3×4 right triangle → hypotenuse 5
    const dist = calcMeasureDistance(0, 0, 3 * CELL, 4 * CELL, CELL);
    expect(dist).toBeCloseTo(5, 5);
  });

  it('works with different cell sizes', () => {
    const dist = calcMeasureDistance(0, 0, 70, 0, 70);
    expect(dist).toBeCloseTo(1, 5);
  });
});

describe('formatMeasureLabel', () => {
  it('formats distance to one decimal place with "sq" suffix', () => {
    expect(formatMeasureLabel(3)).toBe('3.0 sq');
    expect(formatMeasureLabel(1.5)).toBe('1.5 sq');
    expect(formatMeasureLabel(5.123)).toBe('5.1 sq');
  });

  it('handles zero distance', () => {
    expect(formatMeasureLabel(0)).toBe('0.0 sq');
  });
});
