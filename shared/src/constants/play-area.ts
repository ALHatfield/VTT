import type { FogMaskConfig } from '../types/play-area.js';

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

// Token aura constants (Phase 4I)
export const AURA_RADIUS_MIN = 0;
export const AURA_RADIUS_MAX = 12;
export const DEFAULT_AURA_COLOR = '#4a9eff';
export const CONDITION_AURA_COLORS = {
  stunned: '#e05050',
  poisoned: '#cc5de8',
  blessed: '#ffd43b',
} as const;
export const PRESET_AURA_TEMPLATES = {
  auraOfProtection: { radius: 2, color: '#4a9eff', type: 'presence' },
  healingAura: { radius: 3, color: '#4caf6e', type: 'presence' },
  dangerZone: { radius: 4, color: '#e05050', type: 'presence' },
} as const;

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

export const AURA_EVENTS = {
  AURA_UPDATE: 'play-area:aura:update',
  AURA_UPDATED: 'play-area:aura:updated',
} as const;

export type AuraEvent = (typeof AURA_EVENTS)[keyof typeof AURA_EVENTS];

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
  FOG_REGION_DELETE: 'play-area:fog:region:delete',
  // Server → Client
  FOG_REVEALED: 'play-area:fog:revealed',
  FOG_HIDDEN: 'play-area:fog:hidden',
  FOG_REGION_DELETED: 'play-area:fog:region:deleted',
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

// Fog mask pipeline constants (Phase PM2)
export const FOG_CONFIG_EVENTS = {
  /** Server → Client: scene fog configuration changed. */
  FOG_CONFIG_UPDATED: 'play-area:fog:config:updated',
  /** Server → Client: explored areas for the active scene (delta or full replace). */
  FOG_EXPLORATION_SYNC: 'play-area:fog:exploration:sync',
} as const;

export type FogConfigEvent = (typeof FOG_CONFIG_EVENTS)[keyof typeof FOG_CONFIG_EVENTS];

export const FOG_MASK_RESOLUTION_MIN = 0.1;
export const FOG_MASK_RESOLUTION_MAX = 1;
/** Hard cap on either mask texture dimension to bound GPU memory on large maps. */
export const FOG_MASK_MAX_TEXTURE_DIMENSION = 4096;
/** Maximum reveal stamps drawn into a single batched Graphics geometry buffer. */
export const FOG_MASK_STAMPS_PER_BATCH = 512;
/** Number of concentric rings used to approximate a radial soft edge. */
export const FOG_MASK_SOFT_EDGE_STEPS = 6;
/** Blur strength (px) used when edgeSoftness is 'filter'. */
export const FOG_MASK_BLUR_STRENGTH = 8;
/** Exploration stamps are deduplicated onto a grid of this many cells. */
export const FOG_EXPLORATION_QUANTIZE_CELLS = 1;
/** Upper bound on persisted exploration stamps returned for one scene. */
export const FOG_EXPLORATION_MAX_STAMPS = 5000;

export const DEFAULT_FOG_MASK_CONFIG: FogMaskConfig = {
  fogMode: 'legacy',
  explorationMode: 'off',
  edgeSoftness: 'off',
  maskResolutionScale: 0.5,
  shroudAlpha: 0.55,
  hiddenAlpha: 0.78,
  edgeSoftnessRatio: 0.25,
};

// Initiative constants (Phase 4H)
export const INITIATIVE_EVENTS = {
  /** Client → Server: DM starts combat for the current campaign. */
  INITIATIVE_START: 'play-area:initiative:start',
  /** Client → Server: DM advances to the next combatant. */
  INITIATIVE_ADVANCE: 'play-area:initiative:advance',
  /** Client → Server: DM ends combat and clears initiative. */
  INITIATIVE_END: 'play-area:initiative:end',
  /** Client → Server: DM reorders the turn tracker. */
  INITIATIVE_REORDER: 'play-area:initiative:reorder',
  /** Server → Client: current initiative state changed. */
  INITIATIVE_UPDATED: 'play-area:initiative:updated',
} as const;

export type InitiativeEvent = (typeof INITIATIVE_EVENTS)[keyof typeof INITIATIVE_EVENTS];

// Drawing tool constants (Phase 4K)
export const DRAW_THROTTLE_MS = 33; // ~30fps
export const DRAW_DEFAULT_COLOR = '#e53935';
export const DRAW_DEFAULT_WIDTH = 3;
export const DRAW_WIDTH_MIN = 1;
export const DRAW_WIDTH_MAX = 20;

export const DRAW_EVENTS = {
  // Client → Server
  DRAW_STROKE: 'play-area:draw:stroke',
  DRAW_CLEAR: 'play-area:draw:clear',
  // Server → Client
  DRAW_STROKED: 'play-area:draw:stroked',
  DRAW_CLEARED: 'play-area:draw:cleared',
} as const;

export type DrawEvent = (typeof DRAW_EVENTS)[keyof typeof DRAW_EVENTS];

// Measure tool constants (Phase 4J)
export const MEASURE_EVENTS = {
  /** Client → Server: broadcast measurement line while dragging. */
  MEASURE_BROADCAST: 'play-area:measure:broadcast',
  /** Client → Server: clear active measurement line on mouseup or tool switch. */
  MEASURE_CLEAR: 'play-area:measure:clear',
  /** Server → Client: relay measurement broadcast to campaign room. */
  MEASURE_RELAYED: 'play-area:measure:relayed',
  /** Server → Client: relay measurement clear to campaign room. */
  MEASURE_CLEARED: 'play-area:measure:cleared',
} as const;

export type MeasureEvent = (typeof MEASURE_EVENTS)[keyof typeof MEASURE_EVENTS];

/** Line width in pixels for the measurement line overlay. */
export const MEASURE_LINE_WIDTH = 2;
/** Alpha for the measurement line overlay. */
export const MEASURE_LINE_ALPHA = 0.8;
