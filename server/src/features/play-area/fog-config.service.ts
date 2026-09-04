import type { Prisma } from '@prisma/client';

import type { FogMaskConfig } from '@vtt/shared';
import { DEFAULT_FOG_MASK_CONFIG, fogMaskConfigSchema } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';
import { AppError } from '../../shared/middleware/error-handler.js';

/**
 * Merge a persisted (possibly partial or legacy) fog config blob with the
 * defaults and validate the result. Unknown or invalid stored values fall back
 * to defaults rather than breaking the scene.
 */
export function normalizeFogConfig(raw: unknown): FogMaskConfig {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_FOG_MASK_CONFIG };
  }

  const merged = { ...DEFAULT_FOG_MASK_CONFIG, ...(raw as Record<string, unknown>) };
  const parsed = fogMaskConfigSchema.safeParse(merged);

  return parsed.success ? parsed.data : { ...DEFAULT_FOG_MASK_CONFIG };
}

async function findScene(
  sceneId: string,
  campaignId: string,
): Promise<{ fogConfig: Prisma.JsonValue | null }> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, campaignId },
    select: { fogConfig: true },
  });

  if (!scene) {
    throw new AppError(404, 'NOT_FOUND', 'Scene not found');
  }

  return scene;
}

export async function getSceneFogConfig(
  sceneId: string,
  campaignId: string,
): Promise<FogMaskConfig> {
  const scene = await findScene(sceneId, campaignId);
  return normalizeFogConfig(scene.fogConfig);
}

export async function updateSceneFogConfig(
  sceneId: string,
  campaignId: string,
  patch: Partial<FogMaskConfig>,
): Promise<FogMaskConfig> {
  const scene = await findScene(sceneId, campaignId);
  const parsed = fogMaskConfigSchema.safeParse({
    ...normalizeFogConfig(scene.fogConfig),
    ...patch,
  });

  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid fog configuration');
  }

  await prisma.scene.update({
    where: { id: sceneId },
    data: { fogConfig: { ...parsed.data } },
  });

  return parsed.data;
}
