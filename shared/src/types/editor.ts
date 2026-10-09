// Editor shared types — Phase 5A / 5B

import type {
    LIGHT_ANIMATION_MODES,
    LIGHT_EMITTER_TYPES,
    WEATHER_PRESETS,
} from '../constants/editor.js';

/** Editor mode — play mode shows the game UI, editor mode shows the scene builder */
export type EditorMode = 'play' | 'editor';

/** Asset layer category — maps to the three PixiJS container layers */
export type AssetCategory = 'background' | 'playground' | 'foreground';

/** Asset source — distinguishes built-in seeds from campaign-uploaded assets */
export type AssetSource = 'uploaded' | 'builtin';

/** A tile asset uploaded to a campaign's asset library */
export interface TileAsset {
  id: string;
  campaignId: string | null;
  filename: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  category: AssetCategory;
  source: AssetSource;
  createdAt: string;
  updatedAt: string;
}

/** Payload for uploading a new asset (sent as multipart form data metadata) */
export interface AssetUploadPayload {
  category: AssetCategory;
}

// ---------------------------------------------------------------------------
// Phase 5B — Tile placements
// ---------------------------------------------------------------------------

/** A tile asset placed on a scene at a specific position and transform */
export interface TilePlacement {
  id: string;
  sceneId: string;
  assetId: string;
  campaignId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  category: AssetCategory;
  createdAt: string;
  updatedAt: string;
}

/** Payload to create a new tile placement */
export interface CreateTilePlacementPayload {
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  category: AssetCategory;
}

/** Payload to update an existing tile placement (all fields optional) */
export interface UpdateTilePlacementPayload {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
  category?: AssetCategory;
}

// ---------------------------------------------------------------------------
// Phase 5E — Grid Alignment
// ---------------------------------------------------------------------------

/** Configuration for the auto-detection algorithm. */
export interface GridDetectionConfig {
  /** Number of grid cells the traced rectangle spans horizontally. */
  cellsAcross: number;
  /** Number of grid cells the traced rectangle spans vertically. */
  cellsDown: number;
}

/** Result of a grid alignment operation (manual trace or auto-detection). */
export interface GridAlignmentResult {
  /** New tile pixel width after alignment. */
  width: number;
  /** New tile pixel height after alignment. */
  height: number;
  /** Detected or traced grid spacing in original asset pixels. */
  gridSpacingPx: number;
  /** Autocorrelation confidence 0–1. Present only for auto-detected results. */
  confidence?: number;
  /** Whether this result came from auto-detection (true) or manual trace (false). */
  autoDetected: boolean;
}

// ---------------------------------------------------------------------------
// Phase 5F — Wall & obstacle authoring
// ---------------------------------------------------------------------------

/**
 * A single wall segment on a scene, stored as a pair of world-space endpoints.
 * Consumed by play-area PM3 as raycasting input.
 */
export interface WallSegment {
  id: string;
  sceneId: string;
  campaignId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  blocksLight: boolean;
  blocksMovement: boolean;
  isDoor: boolean;
  /** Only meaningful when `isDoor` is true; always false for plain walls. */
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Payload to create a wall segment; flags default server-side when omitted. */
export interface WallSegmentCreatePayload {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  blocksLight?: boolean;
  blocksMovement?: boolean;
  isDoor?: boolean;
  isOpen?: boolean;
}

/** Payload to update a wall segment (all fields optional, at least one required). */
export interface WallSegmentUpdatePayload {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  blocksLight?: boolean;
  blocksMovement?: boolean;
  isDoor?: boolean;
  isOpen?: boolean;
}

/** Server broadcast after any wall mutation — clients re-fetch cached geometry. */
export interface WallsUpdatedPayload {
  campaignId: string;
  sceneId: string;
}

// ---------------------------------------------------------------------------
// Phase 5G — Light emitter authoring
// ---------------------------------------------------------------------------

export type LightEmitterType = (typeof LIGHT_EMITTER_TYPES)[number];

export type LightAnimationMode = (typeof LIGHT_ANIMATION_MODES)[number];

export type WeatherPreset = (typeof WEATHER_PRESETS)[number];

/**
 * An authored light emitter on a scene. Shared with play-area PM4, which renders
 * the glow and animates it client-side from `animationMode` + `animationSeed`.
 */
export interface LightSource {
  id: string;
  sceneId: string;
  campaignId: string;
  x: number;
  y: number;
  /** Radius in grid cells. */
  radius: number;
  /** 6-digit hex color, e.g. `#ff9a3c`. */
  color: string;
  /** 0–1 brightness at the emitter. */
  intensity: number;
  /** 0 = hard edge, 1 = fades across the full radius. */
  falloff: number;
  emitterType: LightEmitterType;
  animationMode: LightAnimationMode;
  /** Server-assigned so every client animates the same light identically. */
  animationSeed: number;
  /** Players see the light (glow and lit area) even without line of sight to it. */
  alwaysVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Payload to create a light; omitted fields fall back to the emitter type's preset. */
export interface LightSourceCreatePayload {
  emitterType: LightEmitterType;
  x: number;
  y: number;
  radius?: number;
  color?: string;
  intensity?: number;
  falloff?: number;
  animationMode?: LightAnimationMode;
  alwaysVisible?: boolean;
}

/** Payload to update a light (all fields optional, at least one required). */
export interface LightSourceUpdatePayload {
  x?: number;
  y?: number;
  radius?: number;
  color?: string;
  intensity?: number;
  falloff?: number;
  emitterType?: LightEmitterType;
  animationMode?: LightAnimationMode;
  alwaysVisible?: boolean;
}

/** Server broadcast after any light mutation — clients re-fetch. */
export interface LightsUpdatedPayload {
  campaignId: string;
  sceneId: string;
}

/** Per-scene atmosphere settings authored in the editor. */
export interface SceneAtmosphere {
  weatherPreset: WeatherPreset;
}

// ---------------------------------------------------------------------------
// Phase 5H — Scene library
// ---------------------------------------------------------------------------

/** A scene as listed in the DM's scene library. */
export interface SceneSummary {
  id: string;
  campaignId: string;
  name: string;
  imageUrl: string | null;
  width: number;
  height: number;
  cellSize: number;
  isActive: boolean;
  sortOrder: number;
  thumbnailUrl: string | null;
  weatherPreset: WeatherPreset;
  createdAt: string;
  updatedAt: string;
}

/** Payload to create a scene; omitted dimensions fall back to server defaults. */
export interface SceneCreatePayload {
  name: string;
  width?: number;
  height?: number;
  cellSize?: number;
}

/** Payload to rename a scene or update its dimensions (at least one field required). */
export interface SceneUpdatePayload {
  name?: string;
  width?: number;
  height?: number;
  cellSize?: number;
}

/** Payload to reorder a campaign's scenes — must list every scene ID exactly once. */
export interface SceneReorderPayload {
  sceneIds: string[];
}
