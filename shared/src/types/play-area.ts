export interface GridConfig {
  cellSize: number;
  visible: boolean;
  color: number;
  alpha: number;
}

export interface MapData {
  id: string;
  campaignId: string;
  name: string;
  imageUrl: string | null;
  width: number;
  height: number;
  gridConfig: GridConfig;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Token types (Phase 4B)
// ---------------------------------------------------------------------------

export type TokenType = 'player' | 'monster' | 'npc' | 'misc';

/** NPC subtype — only set when `type === 'npc'`; null for all other types (Phase 4F.2) */
export type NpcSubtype = 'ally' | 'enemy';

export interface Token {
  id: string;
  sceneId: string;
  campaignId: string;
  /** userId for player-type tokens; null for DM-controlled tokens */
  ownerId: string | null;
  /** Display name of the token owner (player's username); null for DM-controlled tokens */
  ownerName: string | null;
  name: string;
  type: TokenType;
  /** Grid column (0-indexed) */
  x: number;
  /** Grid row (0-indexed) */
  y: number;
  /** Size in grid cells (1 = 1×1, 2 = 2×2) */
  size: number;
  /** Hex color string, e.g. "#4a9eff" */
  color: string;
  iconUrl: string | null;
  hp: number | null;
  maxHp: number | null;
  ac: number | null;
  /** Vision radius in grid cells (default 6 = 30ft darkvision). */
  visionRadius: number;
  /**
   * Only set when `type === 'npc'`. Null for all other token types.
   * Null NPC tokens default to enemy behaviour (Phase 4F.2).
   */
  npcSubtype: NpcSubtype | null;
  createdAt: string;
  updatedAt: string;
}

export interface TokenCreatePayload {
  name: string;
  type: TokenType;
  x: number;
  y: number;
  size?: number;
  color?: string;
  iconUrl?: string;
  hp?: number;
  maxHp?: number;
  ac?: number;
  ownerId?: string;
  visionRadius?: number;
  /** Only valid when `type === 'npc'`. Omit for non-NPC tokens. */
  npcSubtype?: NpcSubtype;
}

export interface TokenUpdatePayload {
  name?: string;
  type?: TokenType;
  size?: number;
  color?: string;
  iconUrl?: string | null;
  hp?: number | null;
  maxHp?: number | null;
  ac?: number | null;
  visionRadius?: number;
  /** Only valid when `type === 'npc'`. Use `null` to clear. */
  npcSubtype?: NpcSubtype | null;
}

// ---------------------------------------------------------------------------
// Vision reveal types (Phase 4F.1)
// ---------------------------------------------------------------------------

/** A single token's dynamic vision reveal circle — computed from current token position. */
export interface TokenVisionReveal {
  tokenId: string;
  /** Grid column of the token. */
  x: number;
  /** Grid row of the token. */
  y: number;
  /** Vision radius in grid cells. */
  visionRadius: number;
  sceneId: string;
}

/** Broadcast payload for a full vision sync of all visible token reveals. Role-gated by server. */
export interface TokenVisionSyncPayload {
  reveals: TokenVisionReveal[];
  sceneId: string;
  campaignId: string;
}

export interface TokenMovePayload {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Socket types (Phase 4C)
// ---------------------------------------------------------------------------

export interface RoomJoinPayload {
  campaignId: string;
}

export interface TokenMoveSocketPayload {
  tokenId: string;
  x: number;
  y: number;
  campaignId: string;
}

export interface TokenMovedPayload {
  tokenId: string;
  x: number;
  y: number;
  campaignId: string;
  userId: string;
}

export interface PresencePayload {
  userId: string;
  username: string;
  campaignId: string;
}

export interface SocketErrorPayload {
  code: string;
  message: string;
}

/** Broadcast after a token's properties (HP, AC, name, etc.) are updated via REST. */
export interface TokenUpdatedPayload {
  token: Token;
  campaignId: string;
}

/** Broadcast after a new token is created on the scene. */
export interface TokenCreatedPayload {
  token: Token;
  campaignId: string;
}

// ---------------------------------------------------------------------------
// Chat types (Phase 4D)
// ---------------------------------------------------------------------------

export type MessageType = 'chat' | 'roll' | 'system';

export interface ChatMessage {
  id: string;
  campaignId: string;
  userId: string;
  /** Denormalized display name — snapshot at send time */
  username: string;
  text: string;
  type: MessageType;
  rollData: unknown;
  createdAt: string;
}

export interface ChatSendPayload {
  campaignId: string;
  text: string;
}

/** Server → Client broadcast when a message is created */
export interface ChatReceivedPayload {
  message: ChatMessage;
}

/** Broadcast after a token is deleted from the scene. */
export interface TokenDeletedPayload {
  tokenId: string;
  campaignId: string;
}

// ---------------------------------------------------------------------------
// Dice types (Phase 4E)
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
}

// ---------------------------------------------------------------------------
// Fog of war types (Phase 4F)
// ---------------------------------------------------------------------------

export interface FogVertex {
  x: number;
  y: number;
}

/**
 * A revealed polygon on a scene. Player visibility is derived from these regions.
 */
export interface FogRegion {
  id: string;
  campaignId: string;
  sceneId: string;
  vertices: FogVertex[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Client intent to reveal a polygon region.
 */
export interface FogRevealPayload {
  campaignId: string;
  sceneId: string;
  vertices: FogVertex[];
}

/**
 * Server broadcast after a region is revealed.
 */
export interface FogRevealedPayload {
  region: FogRegion;
  campaignId: string;
  sceneId: string;
}

/**
 * Client intent to hide an area. The server removes overlapping revealed regions.
 */
export interface FogHidePayload {
  campaignId: string;
  sceneId: string;
  vertices: FogVertex[];
}

/**
 * Server broadcast after hide is applied.
 */
export interface FogHiddenPayload {
  removedRegionIds: string[];
  campaignId: string;
  sceneId: string;
}

// ---------------------------------------------------------------------------
// Scene types (Phase 4B)
// ---------------------------------------------------------------------------

export interface Scene {
  id: string;
  campaignId: string;
  name: string;
  imageUrl: string | null;
  width: number;
  height: number;
  cellSize: number;
  isActive: boolean;
}
