import type { FogExplorationStamp, TokenVisionReveal } from '@vtt/shared';
import { FOG_EXPLORATION_MAX_STAMPS, FOG_EXPLORATION_QUANTIZE_CELLS } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';
import { AppError } from '../../shared/middleware/error-handler.js';

export interface ExplorationCandidate {
  cellKey: string;
  x: number;
  y: number;
  radius: number;
}

async function assertSceneBelongsToCampaign(sceneId: string, campaignId: string): Promise<void> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, campaignId },
    select: { id: true },
  });

  if (!scene) {
    throw new AppError(404, 'NOT_FOUND', 'Scene not found');
  }
}

/**
 * Convert token vision reveals (grid space) into world-space exploration
 * candidates, deduplicated onto a quantization grid so that a token idling or
 * jittering in place does not create unbounded rows.
 */
export function buildExplorationCandidates(
  reveals: Pick<TokenVisionReveal, 'x' | 'y' | 'visionRadius'>[],
  cellSize: number,
  quantizeCells: number = FOG_EXPLORATION_QUANTIZE_CELLS,
): ExplorationCandidate[] {
  const step = Math.max(1, quantizeCells);
  const byKey = new Map<string, ExplorationCandidate>();

  for (const reveal of reveals) {
    if (reveal.visionRadius <= 0) continue;

    const cellX = Math.round(reveal.x / step) * step;
    const cellY = Math.round(reveal.y / step) * step;
    const cellKey = `${cellX.toString()}:${cellY.toString()}`;

    const candidate: ExplorationCandidate = {
      cellKey,
      x: cellX * cellSize + cellSize / 2,
      y: cellY * cellSize + cellSize / 2,
      radius: reveal.visionRadius * cellSize,
    };

    // Two emitters on the same cell collapse to one row — the widest wins.
    const existing = byKey.get(cellKey);
    if (!existing || candidate.radius > existing.radius) {
      byKey.set(cellKey, candidate);
    }
  }

  return [...byKey.values()];
}

/**
 * Persist candidates that are not already recorded and return only the new
 * stamps, so callers can broadcast a delta instead of the whole set.
 *
 * Recording stops once the scene reaches FOG_EXPLORATION_MAX_STAMPS, so the
 * stored set never exceeds what `listExploration` returns and rehydrated
 * clients never lose previously explored ground.
 */
export async function recordExploration(
  sceneId: string,
  campaignId: string,
  candidates: ExplorationCandidate[],
): Promise<FogExplorationStamp[]> {
  if (candidates.length === 0) return [];

  const storedCount = await prisma.fogExploration.count({ where: { sceneId, campaignId } });
  const remaining = FOG_EXPLORATION_MAX_STAMPS - storedCount;
  if (remaining <= 0) return [];

  const existing = await prisma.fogExploration.findMany({
    where: { sceneId, campaignId, cellKey: { in: candidates.map((c) => c.cellKey) } },
    select: { cellKey: true },
  });
  const knownKeys = new Set(existing.map((row) => row.cellKey));

  const fresh = candidates.filter((c) => !knownKeys.has(c.cellKey)).slice(0, remaining);
  if (fresh.length === 0) return [];

  await prisma.fogExploration.createMany({
    data: fresh.map((candidate) => ({
      sceneId,
      campaignId,
      cellKey: candidate.cellKey,
      x: candidate.x,
      y: candidate.y,
      radius: candidate.radius,
    })),
    skipDuplicates: true,
  });

  return fresh.map((candidate) => toStamp(candidate, sceneId, campaignId));
}

export async function listExploration(
  sceneId: string,
  campaignId: string,
): Promise<FogExplorationStamp[]> {
  await assertSceneBelongsToCampaign(sceneId, campaignId);

  const rows = await prisma.fogExploration.findMany({
    where: { sceneId, campaignId },
    orderBy: { createdAt: 'asc' },
    take: FOG_EXPLORATION_MAX_STAMPS,
  });

  return rows.map((row) => toStamp(row, sceneId, campaignId));
}

export async function clearExploration(sceneId: string, campaignId: string): Promise<void> {
  await assertSceneBelongsToCampaign(sceneId, campaignId);
  await prisma.fogExploration.deleteMany({ where: { sceneId, campaignId } });
}

function toStamp(
  row: { cellKey: string; x: number; y: number; radius: number },
  sceneId: string,
  campaignId: string,
): FogExplorationStamp {
  return { id: row.cellKey, x: row.x, y: row.y, radius: row.radius, sceneId, campaignId };
}
