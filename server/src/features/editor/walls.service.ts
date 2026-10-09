// Wall segment service — Phase 5F
import type { WallSegment, WallSegmentCreatePayload, WallSegmentUpdatePayload } from '@vtt/shared';
import { MAX_WALLS_PER_SCENE } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';

export type WallErrorCode =
  | 'SCENE_NOT_FOUND'
  | 'WALL_LIMIT_REACHED'
  | 'DEGENERATE_WALL'
  | 'INVALID_DOOR_STATE';

export class WallServiceError extends Error {
  constructor(
    readonly code: WallErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WallServiceError';
  }
}

const WALL_SELECT = {
  id: true,
  sceneId: true,
  campaignId: true,
  x1: true,
  y1: true,
  x2: true,
  y2: true,
  blocksLight: true,
  blocksMovement: true,
  isDoor: true,
  isOpen: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface WallRow extends Omit<WallSegment, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

function toWallSegment(row: WallRow): WallSegment {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertSceneBelongsToCampaign(campaignId: string, sceneId: string): Promise<void> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, campaignId },
    select: { id: true },
  });
  if (!scene) throw new WallServiceError('SCENE_NOT_FOUND', 'Scene not found');
}

/** List all wall segments on a scene. Throws SCENE_NOT_FOUND for foreign scenes. */
export async function listWalls(campaignId: string, sceneId: string): Promise<WallSegment[]> {
  await assertSceneBelongsToCampaign(campaignId, sceneId);
  const rows = await prisma.wallSegment.findMany({
    where: { campaignId, sceneId },
    select: WALL_SELECT,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map(toWallSegment);
}

/** Create a wall segment. Throws SCENE_NOT_FOUND or WALL_LIMIT_REACHED. */
export async function createWall(
  campaignId: string,
  sceneId: string,
  payload: Required<WallSegmentCreatePayload>,
): Promise<WallSegment> {
  await assertSceneBelongsToCampaign(campaignId, sceneId);

  const count = await prisma.wallSegment.count({ where: { campaignId, sceneId } });
  if (count >= MAX_WALLS_PER_SCENE) {
    throw new WallServiceError(
      'WALL_LIMIT_REACHED',
      `A scene may contain at most ${MAX_WALLS_PER_SCENE} wall segments`,
    );
  }

  const row = await prisma.wallSegment.create({
    data: { ...payload, campaignId, sceneId },
    select: WALL_SELECT,
  });
  return toWallSegment(row);
}

/**
 * Update a wall segment. Returns null when not found in this campaign/scene.
 * Throws DEGENERATE_WALL if the merged endpoints collapse to a point, or
 * INVALID_DOOR_STATE when opening a non-door. Clearing `isDoor` always closes the segment.
 */
export async function updateWall(
  campaignId: string,
  sceneId: string,
  wallId: string,
  payload: WallSegmentUpdatePayload,
): Promise<WallSegment | null> {
  const existing = await prisma.wallSegment.findFirst({
    where: { id: wallId, campaignId, sceneId },
    select: WALL_SELECT,
  });
  if (!existing) return null;

  const merged = { ...existing, ...payload };
  if (merged.x1 === merged.x2 && merged.y1 === merged.y2) {
    throw new WallServiceError('DEGENERATE_WALL', 'Wall endpoints must not be identical');
  }
  if (!merged.isDoor && payload.isOpen === true) {
    throw new WallServiceError('INVALID_DOOR_STATE', 'Only doors can be open');
  }
  const data = merged.isDoor ? payload : { ...payload, isOpen: false };

  try {
    const row = await prisma.wallSegment.update({
      where: { id: wallId },
      data,
      select: WALL_SELECT,
    });
    return toWallSegment(row);
  } catch (err: unknown) {
    // P2025: deleted between findFirst and update
    if ((err as { code?: string }).code === 'P2025') return null;
    throw err;
  }
}

/** Delete one wall segment. Returns false when not found in this campaign/scene. */
export async function deleteWall(
  campaignId: string,
  sceneId: string,
  wallId: string,
): Promise<boolean> {
  const { count } = await prisma.wallSegment.deleteMany({
    where: { id: wallId, campaignId, sceneId },
  });
  return count > 0;
}

/** Delete every wall segment on a scene. Returns the number removed. */
export async function deleteAllWalls(campaignId: string, sceneId: string): Promise<number> {
  await assertSceneBelongsToCampaign(campaignId, sceneId);
  const { count } = await prisma.wallSegment.deleteMany({ where: { campaignId, sceneId } });
  return count;
}
