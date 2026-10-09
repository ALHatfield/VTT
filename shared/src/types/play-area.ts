import type {
    LightAnimationMode,
    LightEmitterType,
    LightSource,
    LightSourceUpdatePayload,
} from './editor.js';

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

export type AuraType = 'presence' | 'turn' | 'condition';

export type AuraCondition = 'stunned' | 'poisoned' | 'blessed';

export interface AuraConfig {
  radius: number;
  color: string;
  visible: boolean;
  type: AuraType;
  condition: AuraCondition | null;
}

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
  auraRadius: number | null;
  auraColor: string | null;
  auraVisible: boolean;
  auraType: AuraType | null;
  auraCondition: AuraCondition | null;
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
  auraRadius?: number;
  auraColor?: string;
  auraVisible?: boolean;
  auraType?: AuraType;
  auraCondition?: AuraCondition | null;
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
  auraRadius?: number | null;
  auraColor?: string | null;
  auraVisible?: boolean;
  auraType?: AuraType | null;
  auraCondition?: AuraCondition | null;
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

export interface AuraUpdatePayload {
  tokenId: string;
  campaignId: string;
  aura: Partial<AuraConfig>;
}

export interface AuraUpdatedPayload {
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
// Initiative types (Phase 4H)
// ---------------------------------------------------------------------------

export interface InitiativeTurnEntry {
  tokenId: string;
  tokenName: string;
  characterId: string | null;
  ownerId: string | null;
  initiativeModifier: number;
  initiativeRoll: number | null;
  initiativeTotal: number | null;
}

export interface InitiativeState {
  campaignId: string;
  active: boolean;
  activeTokenId: string | null;
  round: number;
  turnIndex: number;
  order: InitiativeTurnEntry[];
}

export interface InitiativeStartPayload {
  campaignId: string;
  tokenIds?: string[];
}

export interface InitiativeAdvancePayload {
  campaignId: string;
}

export interface InitiativeEndPayload {
  campaignId: string;
}

export interface InitiativeReorderPayload {
  campaignId: string;
  tokenIds: string[];
}

export interface InitiativeUpdatedPayload {
  state: InitiativeState;
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

/**
 * Client intent to delete a single revealed fog region by id.
 */
export interface FogRegionDeletePayload {
  campaignId: string;
  sceneId: string;
  regionId: string;
}

/**
 * Server broadcast after a single fog region is deleted.
 */
export interface FogRegionDeletedPayload {
  regionId: string;
  campaignId: string;
  sceneId: string;
}

// ---------------------------------------------------------------------------
// Fog mask pipeline types (Phase PM2)
// ---------------------------------------------------------------------------

/** Which fog renderer a scene uses. `legacy` is the Phase 4F polygon path. */
export type FogMode = 'legacy' | 'pm2';

/** Whether previously seen areas stay revealed as a dimmed shroud. */
export type ExplorationMode = 'off' | 'persistent';

/** How reveal boundaries are feathered. `off` is the cheapest mode. */
export type FogEdgeSoftness = 'off' | 'radial' | 'filter';

/** Per-pixel fog state produced by composing the active and explored masks. */
export type FogVisibilityState = 'active' | 'explored' | 'hidden';

/** Scene-level configuration for the PM2 RenderTexture mask pipeline. */
export interface FogMaskConfig {
  fogMode: FogMode;
  explorationMode: ExplorationMode;
  edgeSoftness: FogEdgeSoftness;
  /** Downscale factor applied to the mask RenderTexture relative to map size. */
  maskResolutionScale: number;
  /** Opacity of explored-but-not-currently-visible areas. */
  shroudAlpha: number;
  /** Additional opacity applied to areas that have never been explored. */
  hiddenAlpha: number;
  /** Fraction of a stamp radius used for the soft falloff edge. */
  edgeSoftnessRatio: number;
  /** Wall-ignoring peripheral radius in grid cells from each token's centre; 0 disables it. */
  peripheralVisionRadius: number;
  /** Fog opacity inside the peripheral radius but outside line of sight; beyond is fully black. */
  peripheralShroudAlpha: number;
}

/** A circular reveal emitter stamped into the fog mask, in world pixel space. */
export interface VisionStamp {
  id: string;
  x: number;
  y: number;
  radius: number;
}

/** A persisted explored area for a scene. */
export interface FogExplorationStamp extends VisionStamp {
  sceneId: string;
  campaignId: string;
}

/** Server broadcast after scene fog configuration changes. */
export interface FogConfigUpdatedPayload {
  campaignId: string;
  sceneId: string;
  config: FogMaskConfig;
}

/**
 * Server broadcast carrying explored areas for a scene.
 * `append` merges a newly discovered delta; `replace` swaps the whole set
 * (used when the DM resets exploration).
 */
export interface FogExplorationSyncPayload {
  campaignId: string;
  sceneId: string;
  mode: 'append' | 'replace';
  stamps: FogExplorationStamp[];
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

// ---------------------------------------------------------------------------
// Measure tool types (Phase 4J)
// ---------------------------------------------------------------------------

/** Client → Server: broadcast a measurement line to the campaign room while dragging. */
export interface MeasureBroadcastPayload {
  campaignId: string;
  /** World-pixel X of the measurement start point. */
  startX: number;
  /** World-pixel Y of the measurement start point. */
  startY: number;
  /** World-pixel X of the measurement end point. */
  endX: number;
  /** World-pixel Y of the measurement end point. */
  endY: number;
  /** Player's campaign color (hex string, e.g. "#e03131"). */
  color: string;
  /** When true, only the DM and the sender see this measurement. */
  isPrivate: boolean;
}

/** Client → Server: clear the sender's active measurement line. */
export interface MeasureClearPayload {
  campaignId: string;
  /** Must match the original broadcast — server uses this to route the clear to the same audience. */
  isPrivate: boolean;
}

/** Server → Client: relay of a measure broadcast including the sender's userId. */
export type MeasureRelayedPayload = MeasureBroadcastPayload & { userId: string };

/** Server → Client: relay of a measure clear including the sender's userId. */
export type MeasureClearedPayload = Pick<MeasureClearPayload, 'campaignId'> & { userId: string };

// ---------------------------------------------------------------------------
// Drawing tool types (Phase 4K)
// ---------------------------------------------------------------------------

export interface DrawPoint {
  x: number;
  y: number;
}

export type DrawShapeType = 'freehand' | 'rect' | 'circle';

/** Client → Server: stroke chunk or final stroke payload. */
export interface DrawStrokePayload {
  campaignId: string;
  /** Unique ID for this stroke session — stable across all chunks of the same stroke. */
  strokeId: string;
  points: DrawPoint[];
  color: string;
  width: number;
  shapeType: DrawShapeType;
  /** True on mouseup — marks the stroke as complete. */
  isFinal: boolean;
}

/** Server → Client: relay of a draw stroke including the sender's userId. */
export type DrawStrokeRelayedPayload = DrawStrokePayload & { userId: string };

/** Client → Server: clear drawings. Scope is role-enforced server-side. */
export interface DrawClearPayload {
  campaignId: string;
  /** 'all' — DM clears all drawings. 'own' — user clears only their own. */
  scope: 'all' | 'own';
}

/** Server → Client: relay of a draw clear. */
export interface DrawClearedPayload {
  campaignId: string;
  scope: 'all' | 'own';
  userId: string;
}

// ---------------------------------------------------------------------------
// Dynamic lighting types (Phase PM4)
// ---------------------------------------------------------------------------

/**
 * A DM-placed encounter light. Session-scoped: held in server memory, never
 * persisted to the scene. Shares the render fields of an authored `LightSource`.
 */
export interface TemporaryLight {
  id: string;
  campaignId: string;
  sceneId: string;
  /** World-pixel X. */
  x: number;
  /** World-pixel Y. */
  y: number;
  /** Radius in grid cells. */
  radius: number;
  color: string;
  intensity: number;
  falloff: number;
  emitterType: LightEmitterType;
  animationMode: LightAnimationMode;
  animationSeed: number;
  createdBy: string;
  createdAt: string;
}

/** Client → Server: DM places a temporary light. Omitted fields come from the emitter preset. */
export interface TemporaryLightCreatePayload {
  campaignId: string;
  sceneId: string;
  emitterType: LightEmitterType;
  x: number;
  y: number;
  radius?: number;
  color?: string;
  intensity?: number;
  falloff?: number;
  animationMode?: LightAnimationMode;
}

/** Client → Server: DM edits a temporary light. `changes` reuses the editor light patch shape. */
export interface TemporaryLightUpdatePayload {
  campaignId: string;
  sceneId: string;
  lightId: string;
  changes: LightSourceUpdatePayload;
}

/** Client → Server: DM removes a temporary light. */
export interface TemporaryLightDeletePayload {
  campaignId: string;
  sceneId: string;
  lightId: string;
}

/** Server → Client: full snapshot of a scene's temporary lights after any change. */
export interface TemporaryLightsUpdatedPayload {
  campaignId: string;
  sceneId: string;
  lights: TemporaryLight[];
}

/** REST response for the play-area lighting read — visible to all campaign members. */
export interface SceneLighting {
  authored: LightSource[];
  temporary: TemporaryLight[];
}

// ---------------------------------------------------------------------------
// Line of sight types (Phase PM3)
// ---------------------------------------------------------------------------

/** Axis-aligned bounds in world pixels, used to cull obstacles before raycasting. */
export interface ObstacleBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Result of casting one ray from an emitter; `segmentId` is null when capped by the radius. */
export interface RaycastHit {
  x: number;
  y: number;
  distance: number;
  segmentId: string | null;
}

/** What produced a visibility polygon: a token's vision or a light emitter lighting the area. */
export type VisionSource = 'token' | 'light';

/**
 * Obstacle-aware visible area for one emitter, in world pixels. Points are in
 * ascending-angle order (counter-clockwise in y-up space).
 */
export interface VisibilityPolygon {
  /** Token id (source `token`) or light id (source `light`). */
  emitterId: string;
  source: VisionSource;
  /**
   * Whether players may see this area: party tokens for `token`; for `light`, a party
   * token has line of sight to the light or the light is `alwaysVisible`. Only DMs ever receive `false`.
   */
  partyVisible: boolean;
  sceneId: string;
  origin: FogVertex;
  /** Vision radius in world pixels. */
  radius: number;
  points: FogVertex[];
}

/** A door the viewer may interact with — geometry is limited to the door itself. */
export interface DoorState {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isOpen: boolean;
}

/** Client → Server: request a line-of-sight recompute after wall geometry changed. */
export interface VisionRefreshPayload {
  campaignId: string;
  sceneId: string;
}

/**
 * Server → Client: role-gated visibility polygons and interactive doors.
 * Emitters without nearby obstacles are omitted and fall back to circular reveals.
 */
export interface VisionUpdatedPayload {
  campaignId: string;
  sceneId: string;
  polygons: VisibilityPolygon[];
  doors: DoorState[];
  /** Enemy tokens (see `isEnemyToken`) some party token has a clear sight line to. Empty for observers. */
  visibleEnemyTokenIds: string[];
}

/** Client → Server: open or close a door. */
export interface DoorTogglePayload {
  campaignId: string;
  sceneId: string;
  wallId: string;
}

/** Server → Client: a door changed state. */
export interface DoorToggledPayload {
  campaignId: string;
  sceneId: string;
  wallId: string;
  isOpen: boolean;
}
