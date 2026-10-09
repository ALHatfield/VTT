/**
 * Dice Types
 * Shared between client and server
 */

import type { DICE_SKIN_MATERIALS, ROLL_VISIBILITIES } from '../constants/dice.js';

// ---------------------------------------------------------------------------
// Base roller types (Phase 4E / PM1)
// ---------------------------------------------------------------------------

/** Parsed representation of a dice formula string (e.g. "3d6+4", "d20 advantage"). */
export interface DiceFormula {
  /** The original formula string as submitted by the user, e.g. "3d6+4". */
  raw: string;
  /** Number of dice to roll (e.g. 3 in "3d6"). */
  count: number;
  /** Die type — number of faces (e.g. 6 in "3d6"). */
  sides: number;
  /** Numeric modifier applied after summing kept rolls (e.g. 4 in "3d6+4", -1 in "d8-1"). */
  modifier: number;
  /** Roll two dice, keep the higher (D&D advantage mechanic). Applies when count === 1. */
  advantage: boolean;
  /** Roll two dice, keep the lower (D&D disadvantage mechanic). Applies when count === 1. */
  disadvantage: boolean;
}

/** Full result of a dice roll — persisted as rollData on a chat message. */
export interface RollResult {
  /** Formula string that was rolled, e.g. "3d6+4". */
  formula: string;
  /** Optional source label for sheet-driven rolls, e.g. "DEX" or "Stealth" (Phase 6C). */
  label?: string;
  count: number;
  sides: number;
  /** All individual die values rolled (2 entries when advantage/disadvantage is active). */
  rolls: number[];
  /** Die values that count toward the total (drops the unused die for adv/dis). */
  keptRolls: number[];
  modifier: number;
  advantage: boolean;
  disadvantage: boolean;
  /** Final total: sum(keptRolls) + modifier. */
  total: number;
}

/** Socket payload sent by the client to request a dice roll (Client → Server). */
export interface DiceRollPayload {
  campaignId: string;
  /** The formula portion after stripping the "/roll " prefix, e.g. "3d6+4". */
  formula: string;
  /** Optional source label for sheet-driven rolls, e.g. "DEX" or "Stealth" (Phase 6C). */
  label?: string;
}

/**
 * Which dice roll presentation the client uses (Phase PM1).
 * Mirrors the FogMode pattern — `instant` is the Phase 4E chat-only path,
 * `3d` is the Three.js overlay. New renderers add a mode here.
 */
export type DiceAnimationMode = 'instant' | '3d';

// ---------------------------------------------------------------------------
// Dice feature types (Phase 9B+)
// ---------------------------------------------------------------------------

/** Who can see a roll result (Phase 9B) */
export type RollVisibility = (typeof ROLL_VISIBILITIES)[number];

/** 3D dice material preset (Phase 9E) */
export type DiceSkinMaterial = (typeof DICE_SKIN_MATERIALS)[number];

/**
 * A user-owned saved roll (Phase 9C)
 */
export interface DiceMacro {
  id: string;
  userId: string;
  campaignId: string | null;
  characterId: string | null;
  name: string;
  formula: string;
  visibility: RollVisibility;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payload for creating a dice macro
 */
export interface DiceMacroCreatePayload {
  name: string;
  formula: string;
  visibility?: RollVisibility;
  campaignId?: string;
  characterId?: string;
}

/**
 * Payload for updating a dice macro — at least one field required
 */
export type DiceMacroUpdatePayload = Partial<Omit<DiceMacroCreatePayload, 'campaignId' | 'characterId'>> & {
  sortOrder?: number;
};

/** Server → Client: a macro was created or updated (owner sockets only) */
export interface DiceMacroChangedPayload {
  macro: DiceMacro;
}

/** Server → Client: a macro was deleted (owner sockets only) */
export interface DiceMacroDeletedPayload {
  macroId: string;
}

/**
 * A user's 3D dice appearance (Phase 9E)
 */
export interface DiceSkin {
  userId: string;
  bodyColor: string;
  labelColor: string;
  material: DiceSkinMaterial;
  updatedAt: Date;
}

/**
 * Payload for updating the caller's dice skin
 */
export type DiceSkinUpdatePayload = Partial<Pick<DiceSkin, 'bodyColor' | 'labelColor' | 'material'>>;

/** Server → Client: a user's dice skin changed */
export interface DiceSkinChangedPayload {
  skin: DiceSkin;
}

/** Server → Client: structured dice error */
export interface DiceErrorPayload {
  code: string;
  message: string;
}
