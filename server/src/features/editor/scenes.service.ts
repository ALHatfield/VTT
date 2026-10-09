// Scene library service — Phase 5H
import { mkdir, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';

import type {
    SceneCreatePayload,
    SceneReorderPayload,
    SceneSummary,
    SceneUpdatePayload,
    WeatherPreset,
} from '@vtt/shared';
import { SCENE_NAME_MAX_LENGTH, SCENE_THUMBNAIL_WIDTH } from '@vtt/shared';
import sharp from 'sharp';

import { prisma } from '../../shared/db/prisma.js';

export type SceneErrorCode =
  | 'SCENE_NOT_FOUND'
  | 'SCENE_ACTIVE'
  | 'LAST_SCENE'
  | 'INVALID_ORDER'
  | 'INVALID_IMAGE';

export class SceneServiceError extends Error {
  constructor(
    readonly code: SceneErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SceneServiceError';
  }
}

const SCENE_SELECT = {
  id: true,
  campaignId: true,
  name: true,
  imageUrl: true,
  width: true,
  height: true,
  cellSize: true,
  isActive: true,
  sortOrder: true,
  thumbnailUrl: true,
  weatherPreset: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SCENE_ORDER = [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] as const;

const THUMBNAILS_DIR = join(process.cwd(), 'uploads', 'thumbnails');

/** Decode guard — a 2 MB PNG can decompress far beyond thumbnail-source sizes. */
const THUMBNAIL_SOURCE_PIXEL_LIMIT = 4096 * 4096;

interface SceneRow extends Omit<SceneSummary, 'createdAt' | 'updatedAt' | 'weatherPreset'> {
  weatherPreset: WeatherPreset;
  createdAt: Date;
  updatedAt: Date;
}

function toSceneSummary(row: SceneRow): SceneSummary {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnedScene(campaignId: string, sceneId: string): Promise<SceneRow> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, campaignId },
    select: SCENE_SELECT,
  });
  if (!scene) throw new SceneServiceError('SCENE_NOT_FOUND', 'Scene not found');
  return scene;
}

/** List a campaign's scenes ordered by sortOrder. */
export async function listScenes(campaignId: string): Promise<SceneSummary[]> {
  const rows = await prisma.scene.findMany({
    where: { campaignId },
    select: SCENE_SELECT,
    orderBy: [...SCENE_ORDER],
  });
  return rows.map(toSceneSummary);
}

/** Create a scene appended to the end of the campaign's order. */
export async function createScene(
  campaignId: string,
  payload: SceneCreatePayload,
): Promise<SceneSummary> {
  const row = await prisma.$transaction(async (tx) => {
    const last = await tx.scene.aggregate({
      where: { campaignId },
      _max: { sortOrder: true },
    });
    return tx.scene.create({
      data: {
        campaignId,
        ...payload,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
      select: SCENE_SELECT,
    });
  });
  return toSceneSummary(row);
}

/** Rename a scene or update its dimensions. Throws SCENE_NOT_FOUND. */
export async function updateScene(
  campaignId: string,
  sceneId: string,
  payload: SceneUpdatePayload,
): Promise<SceneSummary> {
  await getOwnedScene(campaignId, sceneId);
  const row = await prisma.scene.update({
    where: { id: sceneId },
    data: payload,
    select: SCENE_SELECT,
  });
  return toSceneSummary(row);
}

/**
 * Delete a scene. Rejects deleting the active scene or the last remaining
 * scene (SCENE_ACTIVE / LAST_SCENE → 409). Checks and delete run in one
 * transaction so a concurrent activation cannot slip through.
 */
export async function deleteScene(campaignId: string, sceneId: string): Promise<void> {
  const removedThumbnailUrl = await prisma.$transaction(async (tx) => {
    const scene = await tx.scene.findFirst({
      where: { id: sceneId, campaignId },
      select: { isActive: true, thumbnailUrl: true },
    });
    if (!scene) throw new SceneServiceError('SCENE_NOT_FOUND', 'Scene not found');
    if (scene.isActive) {
      throw new SceneServiceError('SCENE_ACTIVE', 'The active scene cannot be deleted');
    }
    const count = await tx.scene.count({ where: { campaignId } });
    if (count <= 1) {
      throw new SceneServiceError('LAST_SCENE', 'A campaign must keep at least one scene');
    }
    await tx.scene.delete({ where: { id: sceneId } });
    return scene.thumbnailUrl;
  });
  await removeThumbnailFile(removedThumbnailUrl);
}

/**
 * Duplicate a scene in one transaction, deep-copying tile placements, walls,
 * lights, fogConfig, and weatherPreset. Tokens, fog regions, and fog
 * exploration are session data and are excluded. The copy is never active.
 */
export async function duplicateScene(campaignId: string, sceneId: string): Promise<SceneSummary> {
  await getOwnedScene(campaignId, sceneId);

  const row = await prisma.$transaction(async (tx) => {
    const source = await tx.scene.findFirstOrThrow({ where: { id: sceneId, campaignId } });
    const [placements, walls, lights, last] = await Promise.all([
      tx.tilePlacement.findMany({ where: { sceneId }, orderBy: { createdAt: 'asc' } }),
      tx.wallSegment.findMany({ where: { sceneId }, orderBy: { createdAt: 'asc' } }),
      tx.lightSource.findMany({ where: { sceneId }, orderBy: { createdAt: 'asc' } }),
      tx.scene.aggregate({ where: { campaignId }, _max: { sortOrder: true } }),
    ]);

    const copy = await tx.scene.create({
      data: {
        campaignId,
        name: toCopyName(source.name),
        imageUrl: source.imageUrl,
        width: source.width,
        height: source.height,
        cellSize: source.cellSize,
        isActive: false,
        fogConfig: source.fogConfig ?? undefined,
        weatherPreset: source.weatherPreset,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
      select: SCENE_SELECT,
    });

    if (placements.length > 0) {
      await tx.tilePlacement.createMany({
        data: placements.map(({ assetId, x, y, width, height, rotation, zIndex, category }) => ({
          sceneId: copy.id,
          campaignId,
          assetId,
          x,
          y,
          width,
          height,
          rotation,
          zIndex,
          category,
        })),
      });
    }
    if (walls.length > 0) {
      await tx.wallSegment.createMany({
        data: walls.map(({ x1, y1, x2, y2, blocksLight, blocksMovement, isDoor, isOpen }) => ({
          sceneId: copy.id,
          campaignId,
          x1,
          y1,
          x2,
          y2,
          blocksLight,
          blocksMovement,
          isDoor,
          isOpen,
        })),
      });
    }
    if (lights.length > 0) {
      await tx.lightSource.createMany({
        data: lights.map(
          ({
            x,
            y,
            radius,
            color,
            intensity,
            falloff,
            emitterType,
            animationMode,
            animationSeed,
            alwaysVisible,
          }) => ({
            sceneId: copy.id,
            campaignId,
            x,
            y,
            radius,
            color,
            intensity,
            falloff,
            emitterType,
            animationMode,
            animationSeed,
            alwaysVisible,
          }),
        ),
      });
    }

    return copy;
  });

  return toSceneSummary(row);
}

/**
 * Reorder a campaign's scenes in one transaction. The payload must list every
 * scene in the campaign exactly once; foreign or missing IDs are rejected.
 */
export async function reorderScenes(
  campaignId: string,
  payload: SceneReorderPayload,
): Promise<SceneSummary[]> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.scene.findMany({
      where: { campaignId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((s) => s.id));
    const requestedIds = new Set(payload.sceneIds);
    const isPermutation =
      existingIds.size === requestedIds.size &&
      [...requestedIds].every((id) => existingIds.has(id));
    if (!isPermutation) {
      throw new SceneServiceError(
        'INVALID_ORDER',
        'sceneIds must list every scene in this campaign exactly once',
      );
    }
    for (const [index, id] of payload.sceneIds.entries()) {
      await tx.scene.update({ where: { id }, data: { sortOrder: index } });
    }
  });
  return listScenes(campaignId);
}

/**
 * Re-encode an uploaded thumbnail to WebP at a fixed max width, store it, and
 * replace the scene's previous thumbnail file. The previous URL is swapped out
 * under a row lock so concurrent uploads cannot orphan a file.
 */
export async function setSceneThumbnail(
  campaignId: string,
  sceneId: string,
  imageBuffer: Buffer,
): Promise<SceneSummary> {
  await getOwnedScene(campaignId, sceneId);

  const filename = `scene-thumb_${sceneId}_${Date.now()}.webp`;
  try {
    await mkdir(THUMBNAILS_DIR, { recursive: true });
    await sharp(imageBuffer, { limitInputPixels: THUMBNAIL_SOURCE_PIXEL_LIMIT })
      .resize({ width: SCENE_THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(join(THUMBNAILS_DIR, filename));
  } catch (err: unknown) {
    console.error('[scenes] Thumbnail re-encode failed:', err);
    throw new SceneServiceError('INVALID_IMAGE', 'Could not decode thumbnail image');
  }

  const previousUrl = await prisma.$transaction(async (tx) => {
    // Row lock serializes concurrent uploads so each previous file is deleted exactly once
    const [row] = await tx.$queryRaw<{ thumbnail_url: string | null }[]>`
      SELECT thumbnail_url FROM scenes WHERE id = ${sceneId} FOR UPDATE
    `;
    await tx.scene.update({
      where: { id: sceneId },
      data: { thumbnailUrl: `/uploads/thumbnails/${filename}` },
    });
    return row?.thumbnail_url ?? null;
  });
  await removeThumbnailFile(previousUrl);

  const scene = await getOwnedScene(campaignId, sceneId);
  return toSceneSummary(scene);
}

/** Truncate the source name so the " (copy)" suffix stays within the name bound. */
function toCopyName(sourceName: string): string {
  const suffix = ' (copy)';
  return sourceName.slice(0, SCENE_NAME_MAX_LENGTH - suffix.length) + suffix;
}

/** Delete a stored thumbnail file; ignores missing files and foreign URLs. */
async function removeThumbnailFile(thumbnailUrl: string | null): Promise<void> {
  if (!thumbnailUrl?.startsWith('/uploads/thumbnails/')) return;
  // basename() strips any path segments, preventing traversal outside the dir
  const filename = basename(thumbnailUrl);
  await unlink(join(THUMBNAILS_DIR, filename)).catch(() => undefined);
}
