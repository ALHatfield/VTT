/**
 * Character Types
 * Shared between client and server
 */

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
 * A character sheet — core data model for Phase 6A
 */
export interface Character {
  id: string;
  campaignId: string;
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
