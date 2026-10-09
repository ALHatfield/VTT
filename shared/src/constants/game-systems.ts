/**
 * Game system rules — mechanics for D&D 5e and Pathfinder 2e (Remaster).
 *
 * Only system mechanics are encoded here; content (monsters, spells, items)
 * is user-entered or sourced from ORC/OGL-licensed SRD material.
 * Rules live in shared/ so client and server always compute the same numbers.
 */

import type { GameSystem } from '../types/campaigns.js';

export const GAME_SYSTEM_IDS = ['dnd5e', 'pf2e'] as const;

export const DEFAULT_GAME_SYSTEM: GameSystem = 'dnd5e';

export const GAME_SYSTEM_LABELS: Record<GameSystem, string> = {
  dnd5e: 'D&D 5e',
  pf2e: 'Pathfinder 2e',
};

/** PF2e proficiency ranks (5e has no ranks — it uses a level-based bonus) */
export type ProficiencyRank = 'untrained' | 'trained' | 'expert' | 'master' | 'legendary';

/** Roll modes: 5e advantage/disadvantage; PF2e fortune/misfortune */
export type RollMode = 'normal' | 'advantage' | 'disadvantage' | 'fortune' | 'misfortune';

/** Outcome of a check against a DC */
export type DegreeOfSuccess = 'criticalFailure' | 'failure' | 'success' | 'criticalSuccess';

/** Unit used by the system's encumbrance model: 5e pounds, PF2e Bulk */
export type EncumbranceUnit = 'pounds' | 'bulk';

/** Kind of d20 roll being resolved — 5e only crits/fumbles on attack rolls */
export type RollType = 'check' | 'attack';

export interface GameSystemRules {
  readonly id: GameSystem;
  readonly name: string;
  readonly abbreviation: string;
  readonly maxLevel: number;
  /** Roll modes the system supports (always includes 'normal') */
  readonly rollModes: readonly RollMode[];
  readonly encumbranceUnit: EncumbranceUnit;
  /** Ability modifier derived from an ability score */
  abilityModifier(score: number): number;
  /**
   * Proficiency bonus for a check.
   * 5e: level-based bonus; `rank` is ignored.
   * PF2e: untrained is 0; otherwise rank bonus + level.
   */
  proficiencyBonus(level: number, rank?: ProficiencyRank): number;
  /** Character level earned at a total XP amount (clamped to maxLevel) */
  levelForXp(totalXp: number): number;
  /** Total XP required to reach a level */
  xpForLevel(level: number): number;
  /** Load at which a character becomes encumbered (5e pounds, PF2e Bulk) */
  encumberedAt(strengthScore: number): number;
  /** Maximum load a character can carry (5e pounds, PF2e Bulk) */
  carryMaximum(strengthScore: number): number;
  /**
   * Degree of success for a roll total vs a DC.
   * 5e: pass/fail; on attack rolls only, a natural 20 is a critical success
   * and a natural 1 a critical failure.
   * PF2e: ±10 from the DC crits on every check; a natural 20 upgrades the
   * degree one step and a natural 1 downgrades it one step.
   */
  degreeOfSuccess(total: number, dc: number, naturalRoll?: number, rollType?: RollType): DegreeOfSuccess;
}

const MAX_LEVEL = 20;
const MIN_LEVEL = 1;

const NATURAL_MAX = 20;
const NATURAL_MIN = 1;

function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.floor(level)));
}

/** Shared by both systems: floor((score - 10) / 2) */
function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// ---------------------------------------------------------------------------
// D&D 5e
// ---------------------------------------------------------------------------

/** Total XP required to reach each level (index = level - 1) */
const DND5E_XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
] as const;

const DND5E_PROFICIENCY_BASE = 2;
const DND5E_PROFICIENCY_LEVELS_PER_STEP = 4;

/** Variant encumbrance: encumbered at STR × 5 lbs; capacity STR × 15 lbs */
const DND5E_ENCUMBERED_MULTIPLIER = 5;
const DND5E_CAPACITY_MULTIPLIER = 15;

const dnd5eRules: GameSystemRules = {
  id: 'dnd5e',
  name: 'Dungeons & Dragons 5th Edition',
  abbreviation: 'D&D 5e',
  maxLevel: MAX_LEVEL,
  rollModes: ['normal', 'advantage', 'disadvantage'],
  encumbranceUnit: 'pounds',
  abilityModifier,
  proficiencyBonus(level: number): number {
    const clamped = clampLevel(level);
    return DND5E_PROFICIENCY_BASE + Math.floor((clamped - 1) / DND5E_PROFICIENCY_LEVELS_PER_STEP);
  },
  levelForXp(totalXp: number): number {
    let level = MIN_LEVEL;
    for (let i = 0; i < DND5E_XP_THRESHOLDS.length; i += 1) {
      if (totalXp >= DND5E_XP_THRESHOLDS[i]) {
        level = i + 1;
      }
    }
    return level;
  },
  xpForLevel(level: number): number {
    return DND5E_XP_THRESHOLDS[clampLevel(level) - 1];
  },
  encumberedAt(strengthScore: number): number {
    return strengthScore * DND5E_ENCUMBERED_MULTIPLIER;
  },
  carryMaximum(strengthScore: number): number {
    return strengthScore * DND5E_CAPACITY_MULTIPLIER;
  },
  degreeOfSuccess(
    total: number,
    dc: number,
    naturalRoll?: number,
    rollType: RollType = 'check',
  ): DegreeOfSuccess {
    if (rollType === 'attack') {
      if (naturalRoll === NATURAL_MAX) return 'criticalSuccess';
      if (naturalRoll === NATURAL_MIN) return 'criticalFailure';
    }
    return total >= dc ? 'success' : 'failure';
  },
};

// ---------------------------------------------------------------------------
// Pathfinder 2e (Remaster)
// ---------------------------------------------------------------------------

const PF2E_XP_PER_LEVEL = 1000;

/** Rank bonus added to level when proficient (untrained adds nothing, not even level) */
const PF2E_RANK_BONUSES: Record<ProficiencyRank, number> = {
  untrained: 0,
  trained: 2,
  expert: 4,
  master: 6,
  legendary: 8,
};

/** Bulk limits: encumbered above 5 + STR mod; maximum 10 + STR mod */
const PF2E_ENCUMBERED_BASE_BULK = 5;
const PF2E_MAX_BASE_BULK = 10;

const PF2E_CRIT_MARGIN = 10;

const DEGREE_ORDER: readonly DegreeOfSuccess[] = [
  'criticalFailure',
  'failure',
  'success',
  'criticalSuccess',
];

function shiftDegree(degree: DegreeOfSuccess, steps: number): DegreeOfSuccess {
  const index = DEGREE_ORDER.indexOf(degree);
  const shifted = Math.min(DEGREE_ORDER.length - 1, Math.max(0, index + steps));
  return DEGREE_ORDER[shifted];
}

const pf2eRules: GameSystemRules = {
  id: 'pf2e',
  name: 'Pathfinder Second Edition',
  abbreviation: 'PF2e',
  maxLevel: MAX_LEVEL,
  rollModes: ['normal', 'fortune', 'misfortune'],
  encumbranceUnit: 'bulk',
  abilityModifier,
  proficiencyBonus(level: number, rank: ProficiencyRank = 'untrained'): number {
    if (rank === 'untrained') return 0;
    return PF2E_RANK_BONUSES[rank] + clampLevel(level);
  },
  levelForXp(totalXp: number): number {
    const level = Math.floor(Math.max(0, totalXp) / PF2E_XP_PER_LEVEL) + 1;
    return Math.min(MAX_LEVEL, level);
  },
  xpForLevel(level: number): number {
    return (clampLevel(level) - 1) * PF2E_XP_PER_LEVEL;
  },
  encumberedAt(strengthScore: number): number {
    return PF2E_ENCUMBERED_BASE_BULK + abilityModifier(strengthScore);
  },
  carryMaximum(strengthScore: number): number {
    return PF2E_MAX_BASE_BULK + abilityModifier(strengthScore);
  },
  degreeOfSuccess(total: number, dc: number, naturalRoll?: number): DegreeOfSuccess {
    let degree: DegreeOfSuccess;
    if (total >= dc + PF2E_CRIT_MARGIN) {
      degree = 'criticalSuccess';
    } else if (total >= dc) {
      degree = 'success';
    } else if (total <= dc - PF2E_CRIT_MARGIN) {
      degree = 'criticalFailure';
    } else {
      degree = 'failure';
    }

    if (naturalRoll === NATURAL_MAX) return shiftDegree(degree, 1);
    if (naturalRoll === NATURAL_MIN) return shiftDegree(degree, -1);
    return degree;
  },
};

const RULES_BY_SYSTEM: Record<GameSystem, GameSystemRules> = {
  dnd5e: dnd5eRules,
  pf2e: pf2eRules,
};

/** Look up the rules implementation for a game system */
export function getGameSystemRules(system: GameSystem): GameSystemRules {
  const rules = RULES_BY_SYSTEM[system];
  if (!rules) {
    throw new Error(`Unknown game system: ${String(system)}`);
  }
  return rules;
}
