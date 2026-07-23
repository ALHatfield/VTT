// Editor shared types — Phase 5A / 5B

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
