/**
 * Character Types
 * Shared between client and server
 */

import type { ROLL_ADVANTAGE_MODES, SKILL_NAMES } from '../constants/characters.js';

/**
 * Ability scores for a character
 */
export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

/**
 * Computed ability score modifiers (derived, not stored)
 */
export type AbilityModifiers = {
  [K in keyof AbilityScores]: number;
};

/**
 * Ability score identifier
 */
export type AbilityName = keyof AbilityScores;

/**
 * D&D 5e skill identifier (Phase 6C)
 */
export type SkillName = (typeof SKILL_NAMES)[number];

/**
 * How a d20 roll is made: straight, or roll 2d20 keep higher/lower (Phase 6C)
 */
export type RollAdvantageMode = (typeof ROLL_ADVANTAGE_MODES)[number];

/**
 * A weapon or attack entry on a character sheet (Phase 6C).
 * Attack roll = d20 + ability modifier + proficiency (when proficient);
 * damage roll = damageDice + ability modifier.
 */
export interface CharacterAttack {
  /** Client-generated UUID identifying the attack within the character */
  id: string;
  name: string;
  /** Ability whose modifier applies to attack and damage rolls */
  ability: AbilityName;
  /** Whether the proficiency bonus applies to the attack roll */
  proficient: boolean;
  /** Damage dice expression without modifier, e.g. "1d8" or "2d6" */
  damageDice: string;
}

/**
 * A spell entry on a character sheet (Phase 6D).
 * Spells live in the character's JSON data; order in the array is the
 * display order within each level group (drag-and-drop reordering).
 */
export interface CharacterSpell {
  /** Client-generated UUID identifying the spell within the character */
  id: string;
  name: string;
  /** Spell level: 0 = cantrip, 1–9 = leveled spells */
  level: number;
  /** Whether the spell is currently prepared */
  prepared: boolean;
}

/**
 * Spell slot tracking for one spell level (Phase 6D)
 */
export interface CharacterSpellSlot {
  /** Spell level 1–9 (cantrips have no slots) */
  level: number;
  /** Total slots available at this level */
  max: number;
  /** Slots expended; never exceeds max */
  used: number;
}

/**
 * A character sheet — core data model for Phase 6A.
 * campaignId null = global template (pregen) available to every campaign;
 * templates are cloned into a campaign when linked or assigned.
 */
export interface Character {
  id: string;
  campaignId: string | null;
  userId: string;
  name: string;
  race: string;
  class: string;
  level: number;
  abilityScores: AbilityScores;
  hp: number;
  maxHp: number;
  ac: number;
  proficiencyBonus: number;
  speed: number;
  /** Skills the character is proficient in (Phase 6C) */
  skillProficiencies: SkillName[];
  /** Weapon/attack entries for interactive rolling (Phase 6C) */
  attacks: CharacterAttack[];
  /** Spell entries with prepared state (Phase 6D) */
  spells: CharacterSpell[];
  /** Spell slot max/used per level (Phase 6D) */
  spellSlots: CharacterSpellSlot[];
  portraitUrl: string | null;
  biography: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payload for creating a new character
 */
export interface CharacterCreatePayload {
  name: string;
  race: string;
  class: string;
  level?: number;
  abilityScores: AbilityScores;
  hp: number;
  maxHp: number;
  ac?: number;
  proficiencyBonus?: number;
  speed?: number;
  skillProficiencies?: SkillName[];
  attacks?: CharacterAttack[];
  spells?: CharacterSpell[];
  spellSlots?: CharacterSpellSlot[];
  portraitUrl?: string;
  biography?: string;
}

/**
 * Payload for updating a character
 */
export interface CharacterUpdatePayload {
  name?: string;
  race?: string;
  class?: string;
  level?: number;
  abilityScores?: AbilityScores;
  hp?: number;
  maxHp?: number;
  ac?: number;
  proficiencyBonus?: number;
  speed?: number;
  skillProficiencies?: SkillName[];
  attacks?: CharacterAttack[];
  spells?: CharacterSpell[];
  spellSlots?: CharacterSpellSlot[];
  portraitUrl?: string | null;
  biography?: string | null;
}

/**
 * Payload for quick HP update
 */
export interface CharacterHpUpdatePayload {
  hp: number;
}

/**
 * Response shape for character list endpoint
 */
export interface CharacterListResponse {
  data: Character[];
}

/**
 * Response shape for character detail endpoint
 */
export interface CharacterDetailResponse {
  data: Character;
}

/**
 * Tab identifiers for the character sheet UI
 */
export type CharacterSheetTab = 'stats' | 'biography' | 'inventory' | 'spells';

// ---------------------------------------------------------------------------
// Character-token linking (Phase 6B)
// ---------------------------------------------------------------------------

/**
 * A link between a character sheet and a canvas token
 */
export interface CharacterToken {
  id: string;
  campaignId: string;
  characterId: string;
  tokenId: string;
  /** ISO timestamp (serialized over the wire) */
  createdAt: string;
}

/**
 * Payload for linking a character to a token
 */
export interface CharacterLinkPayload {
  characterId: string;
  tokenId: string;
}

/**
 * Payload for assigning a character to a user (DM only)
 */
export interface CharacterAssignmentPayload {
  userId: string;
}

/**
 * Response shape for the character-token link list endpoint
 */
export interface CharacterTokenListResponse {
  data: CharacterToken[];
}

/**
 * Broadcast payload when a character-token link is created or removed
 */
export interface CharacterLinkUpdatedPayload {
  campaignId: string;
  characterId: string;
  tokenId: string;
  linked: boolean;
}

/**
 * Broadcast payload when a character is assigned to a different user
 */
export interface CharacterAssignmentChangedPayload {
  campaignId: string;
  characterId: string;
  userId: string;
  previousUserId: string;
}

/**
 * Broadcast payload when a character's HP changes (sheet ↔ token sync)
 */
export interface CharacterHpUpdatedPayload {
  campaignId: string;
  characterId: string;
  hp: number;
  maxHp: number;
}

/**
 * Broadcast payload when a character sheet is edited (Phase 6D).
 * Carries the full updated character so clients can apply it without refetching.
 */
export interface CharacterSheetUpdatedPayload {
  campaignId: string;
  characterId: string;
  character: Character;
}
