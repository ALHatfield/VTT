import { Prisma } from '@prisma/client';
import type { CampaignRole, FogRegion, FogVertex } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';
import { AppError } from '../../shared/middleware/error-handler.js';

function toFogRegion(raw: {
  id: string;
  campaignId: string;
  sceneId: string;
  vertices: unknown;
  createdAt: Date;
  updatedAt: Date;
}): FogRegion {
  const vertices = Array.isArray(raw.vertices) ? raw.vertices : [];

  return {
    id: raw.id,
    campaignId: raw.campaignId,
    sceneId: raw.sceneId,
    vertices: vertices as FogVertex[],
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

function getPolygonBounds(vertices: FogVertex[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of vertices) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

function boundsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

async function assertSceneBelongsToCampaign(sceneId: string, campaignId: string): Promise<void> {
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, campaignId } });
  if (!scene) {
    throw new AppError(404, 'NOT_FOUND', 'Scene not found');
  }
}

export async function listFogRegions(
  sceneId: string,
  campaignId: string,
  _userRole: CampaignRole,
): Promise<FogRegion[]> {
  await assertSceneBelongsToCampaign(sceneId, campaignId);

  // Only revealed regions are persisted; response is already filtered for players.
  const rows = await prisma.fogRegion.findMany({
    where: { sceneId, campaignId },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map(toFogRegion);
}

export async function revealFogRegion(
  sceneId: string,
  campaignId: string,
  userId: string,
  vertices: FogVertex[],
): Promise<FogRegion> {
  await assertSceneBelongsToCampaign(sceneId, campaignId);

  const row = await prisma.fogRegion.create({
    data: {
      sceneId,
      campaignId,
      createdByUserId: userId,
      vertices: vertices as unknown as Prisma.InputJsonValue,
    },
  });

  return toFogRegion(row);
}

export async function hideFogByPolygon(
  sceneId: string,
  campaignId: string,
  vertices: FogVertex[],
): Promise<string[]> {
  await assertSceneBelongsToCampaign(sceneId, campaignId);

  const hideBounds = getPolygonBounds(vertices);

  const rows = await prisma.fogRegion.findMany({
    where: { sceneId, campaignId },
    select: { id: true, vertices: true },
  });

  const idsToRemove: string[] = [];
  for (const row of rows) {
    const regionVertices = Array.isArray(row.vertices)
      ? (row.vertices as unknown as FogVertex[])
      : [];
    if (regionVertices.length < 3) continue;

    const regionBounds = getPolygonBounds(regionVertices);
    if (boundsOverlap(hideBounds, regionBounds)) {
      idsToRemove.push(row.id);
    }
  }

  if (idsToRemove.length === 0) return [];

  await prisma.fogRegion.deleteMany({ where: { id: { in: idsToRemove } } });
  return idsToRemove;
}

export async function deleteFogRegion(
  regionId: string,
  sceneId: string,
  campaignId: string,
): Promise<void> {
  await assertSceneBelongsToCampaign(sceneId, campaignId);

  const region = await prisma.fogRegion.findFirst({
    where: { id: regionId, sceneId, campaignId },
  });

  if (!region) {
    throw new AppError(404, 'NOT_FOUND', 'Fog region not found');
  }

  await prisma.fogRegion.delete({ where: { id: regionId } });
}
