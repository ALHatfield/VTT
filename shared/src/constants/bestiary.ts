/**
 * Bestiary constants
 */

export const CREATURE_NAME_MAX_LENGTH = 100;
export const CREATURE_TYPE_MAX_LENGTH = 50;
export const CREATURE_HP_FORMULA_MAX_LENGTH = 50;
export const CREATURE_NOTES_MAX_LENGTH = 5000;
export const CREATURE_PORTRAIT_URL_MAX_LENGTH = 2048;

export const CREATURE_AC_MIN = 0;
export const CREATURE_AC_MAX = 60;

export const CREATURE_HP_MIN = 1;
export const CREATURE_HP_MAX = 9999;

export const CREATURE_SPEED_MIN = 0;
export const CREATURE_SPEED_MAX = 200;

export const CREATURE_SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;

// Server → Client only; emitted to DM sockets
export const BESTIARY_EVENTS = {
  CREATURE_CREATED: 'bestiary:creature:created',
  CREATURE_UPDATED: 'bestiary:creature:updated',
  CREATURE_DELETED: 'bestiary:creature:deleted',
  ERROR: 'bestiary:error',
} as const;

export type BestiaryEvent = (typeof BESTIARY_EVENTS)[keyof typeof BESTIARY_EVENTS];
