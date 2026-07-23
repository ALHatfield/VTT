import { describe, expect, it } from 'vitest';
import { calculateModifier, calculateProficiencyBonus, calculateSpellSaveDC } from './characters';

describe('calculateModifier', () => {
  it('returns 0 for a score of 10', () => {
    expect(calculateModifier(10)).toBe(0);
  });

  it('returns 0 for a score of 11', () => {
    expect(calculateModifier(11)).toBe(0);
  });

  it('returns +1 for a score of 12', () => {
    expect(calculateModifier(12)).toBe(1);
  });

  it('returns +5 for a score of 20', () => {
    expect(calculateModifier(20)).toBe(5);
  });

  it('returns -1 for a score of 8', () => {
    expect(calculateModifier(8)).toBe(-1);
  });

  it('returns -5 for a score of 1', () => {
    expect(calculateModifier(1)).toBe(-5);
  });

  it('returns +10 for a score of 30', () => {
    expect(calculateModifier(30)).toBe(10);
  });
});

describe('calculateProficiencyBonus', () => {
  it('returns +2 for levels 1-4', () => {
    expect(calculateProficiencyBonus(1)).toBe(2);
    expect(calculateProficiencyBonus(4)).toBe(2);
  });

  it('returns +3 for levels 5-8', () => {
    expect(calculateProficiencyBonus(5)).toBe(3);
    expect(calculateProficiencyBonus(8)).toBe(3);
  });

  it('returns +4 for levels 9-12', () => {
    expect(calculateProficiencyBonus(9)).toBe(4);
    expect(calculateProficiencyBonus(12)).toBe(4);
  });

  it('returns +5 for levels 13-16', () => {
    expect(calculateProficiencyBonus(13)).toBe(5);
    expect(calculateProficiencyBonus(16)).toBe(5);
  });

  it('returns +6 for levels 17-20', () => {
    expect(calculateProficiencyBonus(17)).toBe(6);
    expect(calculateProficiencyBonus(20)).toBe(6);
  });
});

describe('calculateSpellSaveDC', () => {
  it('calculates spell save DC as 8 + proficiency + modifier', () => {
    // Level 5 wizard with 18 INT → proficiency 3, modifier +4 → DC 15
    expect(calculateSpellSaveDC(3, 4)).toBe(15);
  });

  it('handles negative modifier', () => {
    // 8 + 2 + (-1) = 9
    expect(calculateSpellSaveDC(2, -1)).toBe(9);
  });

  it('calculates DC 10 with zero modifier and minimum proficiency', () => {
    // 8 + 2 + 0 = 10
    expect(calculateSpellSaveDC(2, 0)).toBe(10);
  });
});
