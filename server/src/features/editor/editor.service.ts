// Editor service — Phase 5A / 5B
import { join } from 'node:path';

import type {
  AssetCategory,
  AssetSource,
  CreateTilePlacementPayload,
  TileAsset,
  TilePlacement,
  UpdateTilePlacementPayload,
} from '@vtt/shared';
import { THUMBNAIL_MAX_HEIGHT, THUMBNAIL_MAX_WIDTH } from '@vtt/shared';
import { Jimp } from 'jimp';

import { prisma } from '../../shared/db/prisma.js';

/** Map Prisma TileAsset row → shared TileAsset type */
function toTileAsset(row: {
  id: string;
  campaignId: string | null;
  filename: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  category: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}): TileAsset {
  return {
    id: row.id,
    campaignId: row.campaignId,
    filename: row.filename,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    width: row.width,
    height: row.height,
    category: row.category as AssetCategory,
    source: row.source as AssetSource,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Generate a thumbnail from a source file and save it to the thumbnails directory.
 */
export async function generateThumbnail(
  sourcePath: string,
  thumbnailFilename: string,
): Promise<void> {
  const thumbnailDir = join(process.cwd(), 'uploads', 'thumbnails');
  const thumbnailPath = join(thumbnailDir, thumbnailFilename);

  const image = await Jimp.read(sourcePath);
  const { width, height } = image.bitmap;
  const scale = Math.min(
    THUMBNAIL_MAX_WIDTH / width,
    THUMBNAIL_MAX_HEIGHT / height,
    1, // never upscale
  );
  await image
    .resize({ w: Math.round(width * scale), h: Math.round(height * scale) })
    .write(thumbnailPath as `${string}.${string}`);
}

/**
 * Create a new tile asset record after the file has been uploaded.
 */
export async function createTileAsset(
  campaignId: string,
  filename: string,
  url: string,
  thumbnailUrl: string,
  width: number,
  height: number,
  category: AssetCategory,
): Promise<TileAsset> {
  const asset = await prisma.tileAsset.create({
    data: { campaignId, filename, url, thumbnailUrl, width, height, category },
  });
  return toTileAsset(asset);
}

/**
 * List all tile assets for a campaign, including built-in assets.
 * Optionally filtered by category.
 */
export async function listTileAssets(
  campaignId: string,
  category?: AssetCategory,
): Promise<TileAsset[]> {
  const categoryFilter = category ? { category } : {};
  const assets = await prisma.tileAsset.findMany({
    where: {
      OR: [
        { campaignId, ...categoryFilter },
        { source: 'builtin', ...categoryFilter },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  return assets.map(toTileAsset);
}

/**
 * Get a single tile asset by ID, scoped to campaign or built-in.
 */
export async function getTileAsset(campaignId: string, assetId: string): Promise<TileAsset | null> {
  const asset = await prisma.tileAsset.findFirst({
    where: { id: assetId, OR: [{ campaignId }, { source: 'builtin' }] },
  });
  return asset ? toTileAsset(asset) : null;
}

/**
 * Delete a tile asset record and return its file paths for cleanup.
 * Returns null if asset not found in this campaign.
 * Throws with code 'BUILTIN_ASSET' if the asset is a built-in.
 */
export async function deleteTileAsset(
  campaignId: string,
  assetId: string,
): Promise<{ url: string; thumbnailUrl: string } | null> {
  // Look up by ID without campaign filter first so we can distinguish
  // "not found in this campaign" from "found but is a built-in asset"
  const asset = await prisma.tileAsset.findUnique({
    where: { id: assetId },
  });

  if (!asset) return null;

  if (asset.source === 'builtin') {
    const err = new Error('Built-in assets cannot be deleted') as NodeJS.ErrnoException;
    err.code = 'BUILTIN_ASSET';
    throw err;
  }

  // Scope to campaign — return null if the uploaded asset belongs to a different campaign
  if (asset.campaignId !== campaignId) return null;

  await prisma.tileAsset.delete({ where: { id: assetId } });

  return { url: asset.url, thumbnailUrl: asset.thumbnailUrl };
}

// ---------------------------------------------------------------------------
// Phase 5B — Tile placement CRUD
// ---------------------------------------------------------------------------

/** Map Prisma TilePlacement row → shared TilePlacement type */
function toTilePlacement(row: {
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
  category: string;
  createdAt: Date;
  updatedAt: Date;
}): TilePlacement {
  return {
    id: row.id,
    sceneId: row.sceneId,
    assetId: row.assetId,
    campaignId: row.campaignId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    zIndex: row.zIndex,
    category: row.category as AssetCategory,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Throw with code 'SCENE_NOT_FOUND' if the scene doesn't belong to the campaign. */
async function assertSceneBelongsToCampaign(campaignId: string, sceneId: string): Promise<void> {
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, campaignId } });
  if (!scene) {
    const err = new Error('Scene not found') as NodeJS.ErrnoException;
    err.code = 'SCENE_NOT_FOUND';
    throw err;
  }
}

/**
 * List all tile placements for a scene.
 */
export async function listTilePlacements(
  campaignId: string,
  sceneId: string,
): Promise<TilePlacement[]> {
  await assertSceneBelongsToCampaign(campaignId, sceneId);
  const placements = await prisma.tilePlacement.findMany({
    where: { campaignId, sceneId },
    orderBy: [{ category: 'asc' }, { zIndex: 'asc' }],
  });
  return placements.map(toTilePlacement);
}

/**
 * Create a new tile placement on a scene.
 * Throws with code 'ASSET_NOT_FOUND' if the asset doesn't belong to this campaign.
 * Throws with code 'SCENE_NOT_FOUND' if sceneId doesn't belong to the campaign.
 */
export async function createTilePlacement(
  campaignId: string,
  sceneId: string,
  payload: CreateTilePlacementPayload,
): Promise<TilePlacement> {
  await assertSceneBelongsToCampaign(campaignId, sceneId);

  // Verify asset is accessible to this campaign (owned or built-in)
  const asset = await prisma.tileAsset.findFirst({
    where: { id: payload.assetId, OR: [{ campaignId }, { source: 'builtin' }] },
  });
  if (!asset) {
    const err = new Error('Asset not found') as NodeJS.ErrnoException;
    err.code = 'ASSET_NOT_FOUND';
    throw err;
  }

  const placement = await prisma.tilePlacement.create({
    data: {
      sceneId,
      assetId: payload.assetId,
      campaignId,
      x: payload.x,
      y: payload.y,
      width: payload.width,
      height: payload.height,
      rotation: payload.rotation,
      zIndex: payload.zIndex,
      category: payload.category,
    },
  });
  return toTilePlacement(placement);
}

/**
 * Update an existing tile placement.
 * Returns null if not found in this campaign/scene.
 */
export async function updateTilePlacement(
  campaignId: string,
  sceneId: string,
  placementId: string,
  payload: UpdateTilePlacementPayload,
): Promise<TilePlacement | null> {
  const existing = await prisma.tilePlacement.findFirst({
    where: { id: placementId, campaignId, sceneId },
  });
  if (!existing) return null;

  try {
    const updated = await prisma.tilePlacement.update({
      where: { id: placementId },
      data: payload,
    });
    return toTilePlacement(updated);
  } catch (err: unknown) {
    // Prisma P2025: record deleted between findFirst and update (TOCTOU)
    if ((err as { code?: string }).code === 'P2025') return null;
    throw err;
  }
}

/**
 * Delete a tile placement.
 * Returns false if not found in this campaign/scene.
 */
export async function deleteTilePlacement(
  campaignId: string,
  sceneId: string,
  placementId: string,
): Promise<boolean> {
  const existing = await prisma.tilePlacement.findFirst({
    where: { id: placementId, campaignId, sceneId },
  });
  if (!existing) return false;

  try {
    await prisma.tilePlacement.delete({ where: { id: placementId } });
    return true;
  } catch (err: unknown) {
    // Prisma P2025: record deleted between findFirst and delete (TOCTOU)
    if ((err as { code?: string }).code === 'P2025') return false;
    throw err;
  }
}
