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

// ---------------------------------------------------------------------------
// Interactive rolling (Phase 6C)
// ---------------------------------------------------------------------------

/**
 * D&D 5e skill identifiers
 */
export const SKILL_NAMES = [
  'acrobatics',
  'animalHandling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleightOfHand',
  'stealth',
  'survival',
] as const;

/**
 * Skill display labels and governing abilities (D&D 5e)
 */
export const SKILL_DEFINITIONS: ReadonlyArray<{
  name: (typeof SKILL_NAMES)[number];
  label: string;
  ability: (typeof ABILITY_NAMES)[number];
}> = [
  { name: 'acrobatics', label: 'Acrobatics', ability: 'dexterity' },
  { name: 'animalHandling', label: 'Animal Handling', ability: 'wisdom' },
  { name: 'arcana', label: 'Arcana', ability: 'intelligence' },
  { name: 'athletics', label: 'Athletics', ability: 'strength' },
  { name: 'deception', label: 'Deception', ability: 'charisma' },
  { name: 'history', label: 'History', ability: 'intelligence' },
  { name: 'insight', label: 'Insight', ability: 'wisdom' },
  { name: 'intimidation', label: 'Intimidation', ability: 'charisma' },
  { name: 'investigation', label: 'Investigation', ability: 'intelligence' },
  { name: 'medicine', label: 'Medicine', ability: 'wisdom' },
  { name: 'nature', label: 'Nature', ability: 'intelligence' },
  { name: 'perception', label: 'Perception', ability: 'wisdom' },
  { name: 'performance', label: 'Performance', ability: 'charisma' },
  { name: 'persuasion', label: 'Persuasion', ability: 'charisma' },
  { name: 'religion', label: 'Religion', ability: 'intelligence' },
  { name: 'sleightOfHand', label: 'Sleight of Hand', ability: 'dexterity' },
  { name: 'stealth', label: 'Stealth', ability: 'dexterity' },
  { name: 'survival', label: 'Survival', ability: 'wisdom' },
];

/**
 * d20 roll modes: straight roll, or 2d20 keep higher/lower
 */
export const ROLL_ADVANTAGE_MODES = ['normal', 'advantage', 'disadvantage'] as const;

export const CHARACTER_MAX_ATTACKS = 20;
export const ATTACK_NAME_MAX_LENGTH = 50;

// ---------------------------------------------------------------------------
// Spells & slots (Phase 6D)
// ---------------------------------------------------------------------------

export const CHARACTER_MAX_SPELLS = 100;
export const SPELL_NAME_MAX_LENGTH = 100;
/** Spell level 0 = cantrip */
export const SPELL_LEVEL_MIN = 0;
export const SPELL_LEVEL_MAX = 9;
/** Cantrips (level 0) have no slots */
export const SPELL_SLOT_LEVEL_MIN = 1;
export const SPELL_SLOT_MAX_PER_LEVEL = 10;

/**
 * Display labels for spell levels 0–9
 */
export const SPELL_LEVEL_LABELS = [
  'Cantrips',
  '1st Level',
  '2nd Level',
  '3rd Level',
  '4th Level',
  '5th Level',
  '6th Level',
  '7th Level',
  '8th Level',
  '9th Level',
] as const;

/**
 * Damage dice expression without modifier, e.g. "1d8" or "2d6"
 */
export const DAMAGE_DICE_PATTERN = /^([1-9]\d?)?d(4|6|8|10|12|20|100)$/;

/**
 * Builds a d20 roll formula understood by the dice parser,
 * e.g. ( +5, 'advantage') → "d20+5 advantage"
 */
export function buildD20RollFormula(
  modifier: number,
  mode: (typeof ROLL_ADVANTAGE_MODES)[number] = 'normal',
): string {
  const modPart = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : `${modifier}`;
  const modePart = mode === 'normal' ? '' : ` ${mode}`;
  return `d20${modPart}${modePart}`;
}

/**
 * Builds a damage roll formula, e.g. ("1d8", 3) → "1d8+3"
 */
export function buildDamageRollFormula(damageDice: string, modifier: number): string {
  const modPart = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : `${modifier}`;
  return `${damageDice}${modPart}`;
}

/**
 * Character sheet tab options
 */
export const CHARACTER_SHEET_TABS = ['stats', 'biography', 'inventory', 'spells'] as const;

/**
 * Socket.IO events for the characters feature (Phase 6B)
 */
export const CHARACTER_EVENTS = {
  /** A character-token link was created or removed */
  LINK_UPDATED: 'characters:link:updated',
  /** A character was assigned to a different user */
  ASSIGNMENT_CHANGED: 'characters:assignment:changed',
  /** A character's HP changed (sheet ↔ token sync) */
  HP_UPDATED: 'characters:hp:updated',
  /** A character sheet was edited (DM or owner) — Phase 6D */
  SHEET_UPDATED: 'characters:sheet:updated',
} as const;

/**
 * Built-in token/portrait images shipped with the client (public/tokens)
 */
export const TOKEN_IMAGE_OPTIONS = [
  '/tokens/token1.png',
  '/tokens/token2.png',
  '/tokens/token3.png',
  '/tokens/token4.png',
  '/tokens/token5.png',
  '/tokens/token6.png',
] as const;

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
