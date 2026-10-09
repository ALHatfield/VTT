/**
 * Bestiary Types
 * Shared between client and server
 */

import type { AbilityScores } from './characters.js';

export type CreatureSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

/**
 * A campaign-scoped creature stat block template (DM only)
 */
export interface Creature {
  id: string;
  campaignId: string;
  name: string;
  size: CreatureSize;
  creatureType: string;
  ac: number;
  maxHp: number;
  hpFormula: string | null;
  speed: number;
  abilityScores: AbilityScores;
  /** Game-system-specific fields; shape validated against the campaign's game system */
  systemData: Record<string, unknown>;
  portraitUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payload for creating a creature
 */
export interface CreatureCreatePayload {
  name: string;
  size: CreatureSize;
  creatureType: string;
  ac: number;
  maxHp: number;
  hpFormula?: string;
  speed: number;
  abilityScores: AbilityScores;
  systemData?: Record<string, unknown>;
  portraitUrl?: string;
  notes?: string;
}

/**
 * Payload for updating a creature — at least one field required
 */
export type CreatureUpdatePayload = Partial<CreatureCreatePayload>;

/** Server → Client: a creature was created or updated */
export interface CreatureChangedPayload {
  campaignId: string;
  creature: Creature;
}

/** Server → Client: a creature was deleted */
export interface CreatureDeletedPayload {
  campaignId: string;
  creatureId: string;
}

/** Server → Client: structured bestiary error */
export interface BestiaryErrorPayload {
  code: string;
  message: string;
}
