import { describe, expect, it } from 'vitest';

import type { RollResult } from '@vtt/shared';

import { mapRollToDice } from './roll-mapping';

function makeRoll(overrides: Partial<RollResult> = {}): RollResult {
  return {
    formula: '2d6',
    count: 2,
    sides: 6,
    rolls: [3, 5],
    keptRolls: [3, 5],
    modifier: 0,
    advantage: false,
    disadvantage: false,
    total: 8,
    ...overrides,
  };
}

describe('mapRollToDice', () => {
  it('maps a simple multi-die roll', () => {
    const dice = mapRollToDice(makeRoll());
    expect(dice).toEqual([
      { sides: 6, value: 3 },
      { sides: 6, value: 5 },
    ]);
  });

  it('maps advantage rolls (both dice rendered)', () => {
    const dice = mapRollToDice(
      makeRoll({ formula: 'd20 advantage', sides: 20, count: 1, rolls: [7, 18], keptRolls: [18], advantage: true, total: 18 }),
    );
    expect(dice).toEqual([
      { sides: 20, value: 7 },
      { sides: 20, value: 18 },
    ]);
  });

  it.each([4, 6, 8, 10, 12, 20])('supports d%i', (sides) => {
    const dice = mapRollToDice(
      makeRoll({ sides, count: 1, rolls: [1], keptRolls: [1], total: 1 }),
    );
    expect(dice).toEqual([{ sides, value: 1 }]);
  });

  it('returns null for unsupported die sizes (d100)', () => {
    expect(
      mapRollToDice(makeRoll({ sides: 100, count: 1, rolls: [42], keptRolls: [42], total: 42 })),
    ).toBeNull();
  });

  it('returns null when there are too many dice to animate', () => {
    const rolls = Array.from({ length: 9 }, () => 1);
    expect(
      mapRollToDice(makeRoll({ count: 9, rolls, keptRolls: rolls, total: 9 })),
    ).toBeNull();
  });

  it('returns null for empty rolls', () => {
    expect(mapRollToDice(makeRoll({ rolls: [], keptRolls: [], total: 0 }))).toBeNull();
  });

  it('returns null when a value is out of range for the die', () => {
    expect(mapRollToDice(makeRoll({ rolls: [3, 7], keptRolls: [3, 7], total: 10 }))).toBeNull();
  });

  it('returns null when a value is not an integer', () => {
    expect(mapRollToDice(makeRoll({ rolls: [3, 4.5], keptRolls: [3, 4.5], total: 7.5 }))).toBeNull();
  });

  it('returns null for malformed rollData (not an object)', () => {
    expect(mapRollToDice(null)).toBeNull();
    expect(mapRollToDice('3d6')).toBeNull();
    expect(mapRollToDice(42)).toBeNull();
  });

  it('returns null when sides is missing or not a number', () => {
    expect(mapRollToDice({ rolls: [1, 2] })).toBeNull();
    expect(mapRollToDice({ sides: '6', rolls: [1, 2] })).toBeNull();
  });

  it('returns null when rolls is missing or not an array', () => {
    expect(mapRollToDice({ sides: 6 })).toBeNull();
    expect(mapRollToDice({ sides: 6, rolls: 'not-an-array' })).toBeNull();
  });

  it('returns null when rolls contains non-number entries', () => {
    expect(mapRollToDice({ sides: 6, rolls: [3, 'four'] })).toBeNull();
  });
});
