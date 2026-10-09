import { describe, expect, it } from 'vitest';

import {
    DEFAULT_GAME_SYSTEM,
    GAME_SYSTEM_IDS,
    GAME_SYSTEM_LABELS,
    getGameSystemRules,
} from './game-systems.js';

describe('game system registry', () => {
  it('exposes both supported systems', () => {
    expect(GAME_SYSTEM_IDS).toEqual(['dnd5e', 'pf2e']);
    expect(DEFAULT_GAME_SYSTEM).toBe('dnd5e');
  });

  it('has a label for every system', () => {
    for (const id of GAME_SYSTEM_IDS) {
      expect(GAME_SYSTEM_LABELS[id]).toBeTruthy();
    }
  });

  it('getGameSystemRules returns the matching rules object', () => {
    expect(getGameSystemRules('dnd5e').id).toBe('dnd5e');
    expect(getGameSystemRules('pf2e').id).toBe('pf2e');
  });

  it('getGameSystemRules throws for an unknown system', () => {
    expect(() => getGameSystemRules('gurps' as never)).toThrow('Unknown game system');
  });
});

describe('ability modifier (both systems)', () => {
  const cases: Array<[number, number]> = [
    [1, -5],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [15, 2],
    [18, 4],
    [20, 5],
    [30, 10],
  ];

  for (const system of GAME_SYSTEM_IDS) {
    it(`computes floor((score - 10) / 2) for ${system}`, () => {
      const rules = getGameSystemRules(system);
      for (const [score, expected] of cases) {
        expect(rules.abilityModifier(score)).toBe(expected);
      }
    });
  }
});

describe('D&D 5e rules', () => {
  const rules = getGameSystemRules('dnd5e');

  it('proficiency bonus follows the level table', () => {
    expect(rules.proficiencyBonus(1)).toBe(2);
    expect(rules.proficiencyBonus(4)).toBe(2);
    expect(rules.proficiencyBonus(5)).toBe(3);
    expect(rules.proficiencyBonus(8)).toBe(3);
    expect(rules.proficiencyBonus(9)).toBe(4);
    expect(rules.proficiencyBonus(13)).toBe(5);
    expect(rules.proficiencyBonus(17)).toBe(6);
    expect(rules.proficiencyBonus(20)).toBe(6);
  });

  it('proficiency bonus ignores PF2e ranks', () => {
    expect(rules.proficiencyBonus(5, 'legendary')).toBe(3);
  });

  it('levelForXp uses the 5e XP thresholds', () => {
    expect(rules.levelForXp(0)).toBe(1);
    expect(rules.levelForXp(299)).toBe(1);
    expect(rules.levelForXp(300)).toBe(2);
    expect(rules.levelForXp(900)).toBe(3);
    expect(rules.levelForXp(6500)).toBe(5);
    expect(rules.levelForXp(84999)).toBe(10);
    expect(rules.levelForXp(85000)).toBe(11);
    expect(rules.levelForXp(355000)).toBe(20);
    expect(rules.levelForXp(999999)).toBe(20);
  });

  it('xpForLevel returns the threshold for a level', () => {
    expect(rules.xpForLevel(1)).toBe(0);
    expect(rules.xpForLevel(2)).toBe(300);
    expect(rules.xpForLevel(20)).toBe(355000);
  });

  it('max level is 20', () => {
    expect(rules.maxLevel).toBe(20);
  });

  it('encumbrance uses pounds: encumbered at STR×5, max STR×15', () => {
    expect(rules.encumbranceUnit).toBe('pounds');
    expect(rules.encumberedAt(10)).toBe(50);
    expect(rules.carryMaximum(10)).toBe(150);
    expect(rules.carryMaximum(18)).toBe(270);
  });

  it('supports advantage/disadvantage roll modes', () => {
    expect(rules.rollModes).toEqual(['normal', 'advantage', 'disadvantage']);
  });

  it('degree of success is pass/fail against the DC', () => {
    expect(rules.degreeOfSuccess(15, 15)).toBe('success');
    expect(rules.degreeOfSuccess(14, 15)).toBe('failure');
    expect(rules.degreeOfSuccess(30, 15)).toBe('success');
  });

  it('natural 20 crits and natural 1 fumbles on attack rolls regardless of total', () => {
    expect(rules.degreeOfSuccess(22, 30, 20, 'attack')).toBe('criticalSuccess');
    expect(rules.degreeOfSuccess(10, 5, 1, 'attack')).toBe('criticalFailure');
  });

  it('natural 20/1 do not override ability checks and saves', () => {
    expect(rules.degreeOfSuccess(22, 30, 20)).toBe('failure');
    expect(rules.degreeOfSuccess(22, 30, 20, 'check')).toBe('failure');
    expect(rules.degreeOfSuccess(10, 5, 1, 'check')).toBe('success');
  });
});

describe('Pathfinder 2e rules', () => {
  const rules = getGameSystemRules('pf2e');

  it('untrained proficiency is 0 (no level added)', () => {
    expect(rules.proficiencyBonus(20, 'untrained')).toBe(0);
    expect(rules.proficiencyBonus(20)).toBe(0);
  });

  it('trained ranks add rank bonus + level', () => {
    expect(rules.proficiencyBonus(1, 'trained')).toBe(3);
    expect(rules.proficiencyBonus(5, 'expert')).toBe(9);
    expect(rules.proficiencyBonus(10, 'master')).toBe(16);
    expect(rules.proficiencyBonus(20, 'legendary')).toBe(28);
  });

  it('levels every 1000 XP, capped at 20', () => {
    expect(rules.levelForXp(0)).toBe(1);
    expect(rules.levelForXp(999)).toBe(1);
    expect(rules.levelForXp(1000)).toBe(2);
    expect(rules.levelForXp(4500)).toBe(5);
    expect(rules.levelForXp(19000)).toBe(20);
    expect(rules.levelForXp(50000)).toBe(20);
  });

  it('xpForLevel is (level - 1) × 1000', () => {
    expect(rules.xpForLevel(1)).toBe(0);
    expect(rules.xpForLevel(2)).toBe(1000);
    expect(rules.xpForLevel(20)).toBe(19000);
  });

  it('encumbrance uses Bulk: encumbered above 5 + STR mod, max 10 + STR mod', () => {
    expect(rules.encumbranceUnit).toBe('bulk');
    expect(rules.encumberedAt(10)).toBe(5);
    expect(rules.carryMaximum(10)).toBe(10);
    expect(rules.encumberedAt(18)).toBe(9);
    expect(rules.carryMaximum(18)).toBe(14);
  });

  it('supports fortune/misfortune roll modes', () => {
    expect(rules.rollModes).toEqual(['normal', 'fortune', 'misfortune']);
  });

  describe('degree of success (±10 rule)', () => {
    it('critical success at DC + 10 or more', () => {
      expect(rules.degreeOfSuccess(25, 15)).toBe('criticalSuccess');
      expect(rules.degreeOfSuccess(24, 15)).toBe('success');
    });

    it('success at or above the DC', () => {
      expect(rules.degreeOfSuccess(15, 15)).toBe('success');
      expect(rules.degreeOfSuccess(14, 15)).toBe('failure');
    });

    it('critical failure at DC - 10 or less', () => {
      expect(rules.degreeOfSuccess(5, 15)).toBe('criticalFailure');
      expect(rules.degreeOfSuccess(6, 15)).toBe('failure');
    });

    it('natural 20 upgrades the degree one step (all check types)', () => {
      expect(rules.degreeOfSuccess(24, 15, 20)).toBe('criticalSuccess');
      expect(rules.degreeOfSuccess(14, 15, 20)).toBe('success');
      expect(rules.degreeOfSuccess(5, 15, 20)).toBe('failure');
      expect(rules.degreeOfSuccess(14, 15, 20, 'attack')).toBe('success');
      // Already critical success — stays at the top
      expect(rules.degreeOfSuccess(25, 15, 20)).toBe('criticalSuccess');
    });

    it('natural 1 downgrades the degree one step', () => {
      expect(rules.degreeOfSuccess(25, 15, 1)).toBe('success');
      expect(rules.degreeOfSuccess(15, 15, 1)).toBe('failure');
      expect(rules.degreeOfSuccess(14, 15, 1)).toBe('criticalFailure');
      // Already critical failure — stays at the bottom
      expect(rules.degreeOfSuccess(5, 15, 1)).toBe('criticalFailure');
    });
  });
});
