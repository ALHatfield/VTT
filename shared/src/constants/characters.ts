/**
 * Character constants
 */

export const CHARACTER_NAME_MAX_LENGTH = 100;
export const CHARACTER_RACE_MAX_LENGTH = 50;
export const CHARACTER_CLASS_MAX_LENGTH = 50;
export const CHARACTER_BIOGRAPHY_MAX_LENGTH = 5000;
export const CHARACTER_PORTRAIT_URL_MAX_LENGTH = 2048;

export const CHARACTER_LEVEL_MIN = 1;
export const CHARACTER_LEVEL_MAX = 20;

export const ABILITY_SCORE_MIN = 1;
export const ABILITY_SCORE_MAX = 30;

export const HP_MIN = 0;
export const HP_MAX = 999;

export const AC_MIN = 0;
export const AC_MAX = 30;

export const SPEED_MIN = 0;
export const SPEED_MAX = 120;

export const PROFICIENCY_BONUS_MIN = 2;
export const PROFICIENCY_BONUS_MAX = 6;

/**
 * Default ability scores for a new character (standard array)
 */
export const DEFAULT_ABILITY_SCORES = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
} as const;

/**
 * Ability score names for iteration
 */
export const ABILITY_NAMES = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const;

/**
 * Character sheet tab options
 */
export const CHARACTER_SHEET_TABS = ['stats', 'biography', 'inventory', 'spells'] as const;

/**
 * Calculates the ability score modifier: Math.floor((score - 10) / 2)
 */
export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Calculates proficiency bonus from level: Math.ceil(level / 4) + 1
 */
export function calculateProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

/**
 * Calculates spell save DC: 8 + proficiency bonus + casting stat modifier
 */
export function calculateSpellSaveDC(
  proficiencyBonus: number,
  castingStatModifier: number,
): number {
  return 8 + proficiencyBonus + castingStatModifier;
}
