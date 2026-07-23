export const DEFAULT_GRID_CELL_SIZE = 70;
export const DEFAULT_GRID_COLOR = 0x000000;
export const DEFAULT_GRID_ALPHA = 0.3;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_FACTOR = 0.1;

// Token constants (Phase 4B)
export const TOKEN_NAME_MAX_LENGTH = 100;
export const TOKEN_SIZE_MIN = 1;
export const TOKEN_SIZE_MAX = 4;
export const DEFAULT_TOKEN_COLOR = '#4a9eff';
export const DEFAULT_TOKEN_SIZE = 1;

// Socket event constants (Phase 4C)
// Client → Server events use present tense; Server → Client use past tense
export const PLAY_AREA_EVENTS = {
  // Client → Server
  ROOM_JOIN: 'play-area:room:join',
  TOKEN_MOVE: 'play-area:token:move',
  // Server → Client (real-time state broadcasts)
  TOKEN_MOVED: 'play-area:token:moved',
  TOKEN_UPDATED: 'play-area:token:updated',
  TOKEN_CREATED: 'play-area:token:created',
  TOKEN_DELETED: 'play-area:token:deleted',
  USER_JOINED: 'play-area:user:joined',
  USER_LEFT: 'play-area:user:left',
  ERROR: 'play-area:error',
} as const;

export type PlayAreaEvent = (typeof PLAY_AREA_EVENTS)[keyof typeof PLAY_AREA_EVENTS];

// Socket debounce delay for token drag events (ms)
export const SOCKET_TOKEN_MOVE_DEBOUNCE_MS = 100;

// Chat constants (Phase 4D)
export const CHAT_MESSAGE_MAX_LENGTH = 2000;
export const CHAT_HISTORY_LIMIT = 50;
export const CHAT_HISTORY_MAX_LIMIT = 100;

// Extend PLAY_AREA_EVENTS with chat events
export const CHAT_EVENTS = {
  // Client → Server
  CHAT_SEND: 'play-area:chat:send',
  // Server → Client
  CHAT_RECEIVED: 'play-area:chat:received',
} as const;

export type ChatEvent = (typeof CHAT_EVENTS)[keyof typeof CHAT_EVENTS];

// Dice constants (Phase 4E)
export const DICE_FORMULA_MAX_LENGTH = 100;
export const DICE_MAX_COUNT = 100;
export const DICE_MAX_SIDES = 1000;

export const DICE_EVENTS = {
  // Client → Server
  DICE_ROLL: 'play-area:dice:roll',
} as const;

export type DiceEvent = (typeof DICE_EVENTS)[keyof typeof DICE_EVENTS];

// Fog constants (Phase 4F)
export const FOG_EVENTS = {
  // Client → Server
  FOG_REVEAL: 'play-area:fog:reveal',
  FOG_HIDE: 'play-area:fog:hide',
  // Server → Client
  FOG_REVEALED: 'play-area:fog:revealed',
  FOG_HIDDEN: 'play-area:fog:hidden',
} as const;

export type FogEvent = (typeof FOG_EVENTS)[keyof typeof FOG_EVENTS];

export const FOG_OVERLAY_COLOR = 0x000000;
export const FOG_OVERLAY_ALPHA = 0.9;

// Vision constants (Phase 4F.1)
export const DEFAULT_VISION_RADIUS = 6;
/** Maximum allowed vision radius in grid cells (enforced server-side). */
export const VISION_RADIUS_MAX = 30;
/** Debounce delay for vision sync broadcasts after token moves (ms). */
export const VISION_SYNC_DEBOUNCE_MS = 200;
export const TOKEN_VISION_EVENTS = {
  /** Server → Client: full vision sync after any token moves. Payload is role-gated per socket. */
  TOKEN_VISION_SYNC: 'play-area:token:vision:sync',
} as const;

export type TokenVisionEvent = (typeof TOKEN_VISION_EVENTS)[keyof typeof TOKEN_VISION_EVENTS];
