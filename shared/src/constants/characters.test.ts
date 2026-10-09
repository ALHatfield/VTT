import { describe, expect, it } from 'vitest';
import {
    ATTACK_NAME_MAX_LENGTH,
    buildD20RollFormula,
    buildDamageRollFormula,
    calculateModifier,
    calculateProficiencyBonus,
    calculateSpellSaveDC,
    DAMAGE_DICE_PATTERN,
    SKILL_DEFINITIONS,
    SKILL_NAMES,
} from './characters';
import { ROLL_LABEL_MAX_LENGTH } from './dice';

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

describe('buildD20RollFormula (Phase 6C)', () => {
  it('builds a plain d20 roll with no modifier', () => {
    expect(buildD20RollFormula(0)).toBe('d20');
  });

  it('builds a positive modifier roll', () => {
    expect(buildD20RollFormula(5)).toBe('d20+5');
  });

  it('builds a negative modifier roll', () => {
    expect(buildD20RollFormula(-2)).toBe('d20-2');
  });

  it('appends advantage mode', () => {
    expect(buildD20RollFormula(5, 'advantage')).toBe('d20+5 advantage');
  });

  it('appends disadvantage mode', () => {
    expect(buildD20RollFormula(-1, 'disadvantage')).toBe('d20-1 disadvantage');
  });

  it('appends advantage with no modifier', () => {
    expect(buildD20RollFormula(0, 'advantage')).toBe('d20 advantage');
  });
});

describe('buildDamageRollFormula (Phase 6C)', () => {
  it('appends a positive modifier', () => {
    expect(buildDamageRollFormula('1d8', 3)).toBe('1d8+3');
  });

  it('appends a negative modifier', () => {
    expect(buildDamageRollFormula('2d6', -1)).toBe('2d6-1');
  });

  it('omits a zero modifier', () => {
    expect(buildDamageRollFormula('1d12', 0)).toBe('1d12');
  });
});

describe('SKILL_DEFINITIONS (Phase 6C)', () => {
  it('defines all 18 D&D 5e skills exactly once', () => {
    expect(SKILL_DEFINITIONS).toHaveLength(18);
    expect(new Set(SKILL_DEFINITIONS.map((s) => s.name)).size).toBe(18);
    expect(SKILL_DEFINITIONS.map((s) => s.name).sort()).toEqual([...SKILL_NAMES].sort());
  });

  it('maps stealth to dexterity and athletics to strength', () => {
    expect(SKILL_DEFINITIONS.find((s) => s.name === 'stealth')?.ability).toBe('dexterity');
    expect(SKILL_DEFINITIONS.find((s) => s.name === 'athletics')?.ability).toBe('strength');
  });
});

describe('DAMAGE_DICE_PATTERN (Phase 6C)', () => {
  it('accepts standard damage dice', () => {
    for (const dice of ['1d4', 'd6', '2d6', '1d8', '10d10', '1d12', '2d20']) {
      expect(DAMAGE_DICE_PATTERN.test(dice)).toBe(true);
    }
  });

  it('rejects malformed expressions', () => {
    for (const dice of ['banana', '1d7', '0d6', '1d8+3', 'd', '100d6']) {
      expect(DAMAGE_DICE_PATTERN.test(dice)).toBe(false);
    }
  });
});

describe('roll label limits (Phase 6C)', () => {
  it('keeps the longest attack-derived label within the roll label limit', () => {
    // Labels are "{attack name} attack" / "{attack name} damage" (7 extra chars)
    expect(ATTACK_NAME_MAX_LENGTH + ' attack'.length).toBeLessThanOrEqual(ROLL_LABEL_MAX_LENGTH);
  });
});
