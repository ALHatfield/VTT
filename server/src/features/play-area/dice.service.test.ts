import { describe, expect, it } from 'vitest';

import { parseDiceFormula, rollDiceFormula } from './dice.service.js';

// ---------------------------------------------------------------------------
// parseDiceFormula
// ---------------------------------------------------------------------------

describe('parseDiceFormula', () => {
  describe('valid formulas', () => {
    it('parses a simple die with no count', () => {
      const result = parseDiceFormula('d6');
      expect(result).toEqual({
        raw: 'd6',
        count: 1,
        sides: 6,
        modifier: 0,
        advantage: false,
        disadvantage: false,
      });
    });

    it('parses a die with an explicit count', () => {
      const result = parseDiceFormula('3d6');
      expect(result).toMatchObject({ count: 3, sides: 6, modifier: 0 });
    });

    it('parses a positive modifier', () => {
      const result = parseDiceFormula('2d8+4');
      expect(result).toMatchObject({ count: 2, sides: 8, modifier: 4 });
    });

    it('parses a negative modifier', () => {
      const result = parseDiceFormula('d20-2');
      expect(result).toMatchObject({ count: 1, sides: 20, modifier: -2 });
    });

    it('parses modifier with spaces around operator', () => {
      const result = parseDiceFormula('1d6 + 3');
      expect(result).toMatchObject({ modifier: 3 });
    });

    it('is case-insensitive', () => {
      const result = parseDiceFormula('D20');
      expect(result).toMatchObject({ sides: 20 });
    });

    it('preserves the raw string', () => {
      const result = parseDiceFormula('3d6+4');
      expect(result?.raw).toBe('3d6+4');
    });
  });

  describe('advantage / disadvantage', () => {
    it('parses advantage keyword', () => {
      const result = parseDiceFormula('d20 advantage');
      expect(result).toMatchObject({ sides: 20, advantage: true, disadvantage: false });
    });

    it('parses disadvantage keyword', () => {
      const result = parseDiceFormula('d20 disadvantage');
      expect(result).toMatchObject({ sides: 20, advantage: false, disadvantage: true });
    });

    it('is case-insensitive for advantage', () => {
      const result = parseDiceFormula('d20 Advantage');
      expect(result).toMatchObject({ advantage: true });
    });

    it('returns null when both advantage and disadvantage are present', () => {
      expect(parseDiceFormula('d20 advantage disadvantage')).toBeNull();
    });
  });

  describe('invalid formulas', () => {
    it('returns null for empty string', () => {
      expect(parseDiceFormula('')).toBeNull();
    });

    it('returns null for plain text', () => {
      expect(parseDiceFormula('attack')).toBeNull();
    });

    it('returns null for missing sides', () => {
      expect(parseDiceFormula('3d')).toBeNull();
    });

    it('returns null for 1-sided die', () => {
      expect(parseDiceFormula('d1')).toBeNull();
    });

    it('returns null when count exceeds DICE_MAX_COUNT (100)', () => {
      expect(parseDiceFormula('101d6')).toBeNull();
    });

    it('returns null when sides exceed DICE_MAX_SIDES (1000)', () => {
      expect(parseDiceFormula('d1001')).toBeNull();
    });

    it('returns null for zero count', () => {
      expect(parseDiceFormula('0d6')).toBeNull();
    });

    it('returns null when modifier exceeds ±10,000', () => {
      expect(parseDiceFormula('d20+10001')).toBeNull();
      expect(parseDiceFormula('d20-10001')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// rollDiceFormula
// ---------------------------------------------------------------------------

describe('rollDiceFormula', () => {
  it('returns a result within valid range for d6', () => {
    const formula = parseDiceFormula('d6');
    expect(formula).not.toBeNull();
    const result = rollDiceFormula(formula!);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeLessThanOrEqual(6);
    expect(result.rolls).toHaveLength(1);
    expect(result.keptRolls).toHaveLength(1);
  });

  it('rolls multiple dice and sums them', () => {
    const formula = parseDiceFormula('3d6');
    expect(formula).not.toBeNull();
    const result = rollDiceFormula(formula!);
    expect(result.rolls).toHaveLength(3);
    expect(result.keptRolls).toHaveLength(3);
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.total).toBeLessThanOrEqual(18);
  });

  it('applies a positive modifier', () => {
    const formula = parseDiceFormula('d6+10');
    expect(formula).not.toBeNull();
    const result = rollDiceFormula(formula!);
    // With modifier +10, minimum total is 1+10=11
    expect(result.total).toBeGreaterThanOrEqual(11);
    expect(result.modifier).toBe(10);
  });

  it('applies a negative modifier', () => {
    const formula = parseDiceFormula('d20-5');
    expect(formula).not.toBeNull();
    const result = rollDiceFormula(formula!);
    expect(result.modifier).toBe(-5);
    // minimum: 1 - 5 = -4
    expect(result.total).toBeGreaterThanOrEqual(-4);
  });

  describe('advantage', () => {
    it('rolls two dice and keeps the higher', () => {
      // Run many times — the kept roll should always equal Math.max(rolls)
      const formula = parseDiceFormula('d20 advantage');
      expect(formula).not.toBeNull();
      for (let i = 0; i < 50; i++) {
        const result = rollDiceFormula(formula!);
        expect(result.rolls).toHaveLength(2);
        expect(result.keptRolls).toHaveLength(1);
        expect(result.keptRolls[0]).toBe(Math.max(...result.rolls));
      }
    });

    it('total equals keptRoll + modifier', () => {
      const formula = parseDiceFormula('d20 advantage');
      expect(formula).not.toBeNull();
      const result = rollDiceFormula(formula!);
      expect(result.total).toBe(result.keptRolls[0] + result.modifier);
    });
  });

  describe('disadvantage', () => {
    it('rolls two dice and keeps the lower', () => {
      const formula = parseDiceFormula('d20 disadvantage');
      expect(formula).not.toBeNull();
      for (let i = 0; i < 50; i++) {
        const result = rollDiceFormula(formula!);
        expect(result.rolls).toHaveLength(2);
        expect(result.keptRolls).toHaveLength(1);
        expect(result.keptRolls[0]).toBe(Math.min(...result.rolls));
      }
    });
  });

  it('populates formula metadata on the result', () => {
    const formula = parseDiceFormula('2d8+3');
    expect(formula).not.toBeNull();
    const result = rollDiceFormula(formula!);
    expect(result.formula).toBe('2d8+3');
    expect(result.count).toBe(2);
    expect(result.sides).toBe(8);
    expect(result.modifier).toBe(3);
  });
});
