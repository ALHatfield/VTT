/**
 * Dice constants
 */

// Base roller constants (Phase 4E)
export const DICE_FORMULA_MAX_LENGTH = 100;
export const DICE_MAX_COUNT = 100;
export const DICE_MAX_SIDES = 1000;
/** Max length for the optional roll source label, e.g. "Stealth" (Phase 6C). */
export const ROLL_LABEL_MAX_LENGTH = 60;
/** Server-side floor between rolls from the same user — one roll at a time. */
export const DICE_ROLL_COOLDOWN_MS = 1000;

export const DICE_EVENTS = {
  // Client → Server
  DICE_ROLL: 'dice:roll',
  /** @deprecated Pre-9F name for `DICE_ROLL` — still accepted by the server for one release. */
  DICE_ROLL_LEGACY: 'play-area:dice:roll',
} as const;

export type DiceEvent = (typeof DICE_EVENTS)[keyof typeof DICE_EVENTS];

// 3D dice animation constants (Phase PM1)
/** Die side counts the 3D renderer supports; other sizes fall back to instant reveal. */
export const DICE_3D_SUPPORTED_SIDES = [4, 6, 8, 10, 12, 20] as const;
/** Max dice animated per roll — matches the renderer's release position spread. */
export const DICE_3D_MAX_DICE = 8;
/** Max rolls animating/lingering at once — matches the renderer's landing slots. */
export const DICE_3D_MAX_CONCURRENT_ROLLS = 4;
/** Safety timeout: if the 3D animation never completes, reveal the roll in chat anyway. */
export const DICE_3D_REVEAL_TIMEOUT_MS = 8000;
/** localStorage key for the per-user dice animation mode preference. */
export const DICE_3D_STORAGE_KEY = 'vtt:dice-animation-mode';

export const ROLL_VISIBILITIES = ['public', 'gm', 'blind', 'self'] as const;

export const DICE_MACRO_NAME_MAX_LENGTH = 50;
export const DICE_MACRO_MAX_PER_USER = 100;

export const DICE_SKIN_MATERIALS = ['plastic', 'metal', 'glass', 'stone'] as const;

export const DICE_FEATURE_EVENTS = {
  // Server → Client; emitted to the owner's sockets only
  MACRO_CREATED: 'dice:macro:created',
  MACRO_UPDATED: 'dice:macro:updated',
  MACRO_DELETED: 'dice:macro:deleted',
  // Server → Client; emitted to the owner's campaign rooms
  SKIN_UPDATED: 'dice:skin:updated',
  ERROR: 'dice:error',
} as const;

export type DiceFeatureEvent = (typeof DICE_FEATURE_EVENTS)[keyof typeof DICE_FEATURE_EVENTS];
