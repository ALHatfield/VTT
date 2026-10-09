// Editor shared constants — Phase 5A / 5B

/** Allowed MIME types for asset uploads */
export const ALLOWED_ASSET_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Allowed file extensions for asset uploads */
export const ALLOWED_ASSET_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const;

/** Maximum file size for asset uploads (10 MB) */
export const MAX_ASSET_FILE_SIZE = 10 * 1024 * 1024;

/** Thumbnail dimensions (px) — maintains aspect ratio, fits within this box */
export const THUMBNAIL_MAX_WIDTH = 200;
export const THUMBNAIL_MAX_HEIGHT = 200;

/** Valid asset categories */
export const ASSET_CATEGORIES = ['background', 'playground', 'foreground'] as const;

/** Auto-save debounce delay for tile placement changes (ms) */
export const PLACEMENT_AUTOSAVE_DEBOUNCE_MS = 500;

/** Minimum autocorrelation confidence score to accept an auto-detection result (0–1). */
export const GRID_DETECTION_MIN_CONFIDENCE = 0.6;

/** Max time (ms) allowed for auto-detection before reporting failure. */
export const GRID_DETECTION_TIMEOUT_MS = 500;

// Phase 5F — Wall authoring

export const EDITOR_EVENTS = {
  /** Server → Client: walls on a scene changed; re-fetch cached geometry. */
  WALLS_UPDATED: 'editor:walls:updated',
  /** Server → Client: authored lights on a scene changed; re-fetch (Phase 5G). */
  LIGHTS_UPDATED: 'editor:lights:updated',
} as const;

export type EditorEvent = (typeof EDITOR_EVENTS)[keyof typeof EDITOR_EVENTS];

/** Absolute bound for wall endpoint coordinates (world px). */
export const WALL_COORDINATE_LIMIT = 100_000;

/** Maximum number of wall segments allowed on a single scene. */
export const MAX_WALLS_PER_SCENE = 2000;

// Phase 5G — Light emitter authoring

export const LIGHT_EMITTER_TYPES = ['torch', 'fireplace', 'lantern', 'beacon', 'custom'] as const;

export const LIGHT_ANIMATION_MODES = ['none', 'flicker', 'pulse'] as const;

/** Per-scene default weather/atmosphere; rendered by play-area PM5. */
export const WEATHER_PRESETS = ['none', 'rain', 'snow', 'haze'] as const;

/** Absolute bound for light position coordinates (world px). */
export const LIGHT_COORDINATE_LIMIT = WALL_COORDINATE_LIMIT;

/** Light radius bounds, in grid cells. */
export const LIGHT_RADIUS_MIN = 0.5;
export const LIGHT_RADIUS_MAX = 60;

/** Maximum number of authored lights allowed on a single scene. */
export const MAX_LIGHTS_PER_SCENE = 500;

/** Exclusive upper bound for the persisted animation seed (fits a signed 32-bit int). */
export const LIGHT_ANIMATION_SEED_MAX = 2_147_483_647;

export type LightTone = 'warm' | 'cold' | 'neutral';

export interface LightPreset {
  label: string;
  tone: LightTone;
  /** Radius in grid cells. */
  radius: number;
  color: string;
  /** 0–1 brightness at the emitter. */
  intensity: number;
  /** 0 = hard edge, 1 = fades across the full radius. */
  falloff: number;
  animationMode: (typeof LIGHT_ANIMATION_MODES)[number];
}

/** Named defaults applied server-side when a light is created from a preset. */
export const LIGHT_PRESETS: Readonly<
  Record<(typeof LIGHT_EMITTER_TYPES)[number], Readonly<LightPreset>>
> = {
  torch: {
    label: 'Torch',
    tone: 'warm',
    radius: 8,
    color: '#ff9a3c',
    intensity: 0.8,
    falloff: 0.5,
    animationMode: 'flicker',
  },
  fireplace: {
    label: 'Fireplace',
    tone: 'warm',
    radius: 6,
    color: '#ff6a1f',
    intensity: 0.9,
    falloff: 0.7,
    animationMode: 'flicker',
  },
  lantern: {
    label: 'Lantern',
    tone: 'warm',
    radius: 6,
    color: '#ffd27f',
    intensity: 0.7,
    falloff: 0.5,
    animationMode: 'none',
  },
  beacon: {
    label: 'Aura Beacon',
    tone: 'cold',
    radius: 4,
    color: '#7fb2ff',
    intensity: 0.6,
    falloff: 0.8,
    animationMode: 'pulse',
  },
  custom: {
    label: 'Custom',
    tone: 'neutral',
    radius: 4,
    color: '#ffffff',
    intensity: 0.7,
    falloff: 0.5,
    animationMode: 'none',
  },
};

// Phase 5H — Scene library

/** Scene name length bounds. */
export const SCENE_NAME_MIN_LENGTH = 1;
export const SCENE_NAME_MAX_LENGTH = 100;

/** Scene pixel dimension bounds (width/height). */
export const SCENE_DIMENSION_MIN = 256;
export const SCENE_DIMENSION_MAX = 16_384;

/** Scene grid cell size bounds (px). */
export const SCENE_CELL_SIZE_MIN = 16;
export const SCENE_CELL_SIZE_MAX = 512;

/** Maximum upload size for a scene thumbnail (2 MB). */
export const MAX_SCENE_THUMBNAIL_FILE_SIZE = 2 * 1024 * 1024;

/** Allowed MIME types for scene thumbnail uploads. */
export const ALLOWED_SCENE_THUMBNAIL_MIME_TYPES = ['image/png', 'image/webp'] as const;

/** Fixed max width (px) thumbnails are re-encoded to server-side, and captured at client-side. */
export const SCENE_THUMBNAIL_WIDTH = 320;

/** Debounce (ms) between an editor change and the client-side thumbnail capture. */
export const SCENE_THUMBNAIL_CAPTURE_DEBOUNCE_MS = 3000;
