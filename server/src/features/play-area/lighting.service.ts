// Play-area lighting read service — Phase PM4
// Read-only view of editor-authored lights (5G) plus session-scoped temporary lights.
import type { LightSource, SceneLighting } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';
import { listTemporaryLights } from './temporary-lights.store.js';

export async function sceneBelongsToCampaign(campaignId: string, sceneId: string): Promise<boolean> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, campaignId },
    select: { id: true },
  });
  return scene !== null;
}

/** Returns null when the scene is not in this campaign. */
export async function getSceneLighting(
  campaignId: string,
  sceneId: string,
): Promise<SceneLighting | null> {
  if (!(await sceneBelongsToCampaign(campaignId, sceneId))) return null;

  const rows = await prisma.lightSource.findMany({
    where: { campaignId, sceneId },
    select: {
      id: true,
      sceneId: true,
      campaignId: true,
      x: true,
      y: true,
      radius: true,
      color: true,
      intensity: true,
      falloff: true,
      emitterType: true,
      animationMode: true,
      animationSeed: true,
      alwaysVisible: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const authored: LightSource[] = rows.map((row) => ({
    id: row.id,
    sceneId: row.sceneId,
    campaignId: row.campaignId,
    x: row.x,
    y: row.y,
    radius: row.radius,
    color: row.color,
    intensity: row.intensity,
    falloff: row.falloff,
    emitterType: row.emitterType,
    animationMode: row.animationMode,
    animationSeed: row.animationSeed,
    alwaysVisible: row.alwaysVisible,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return { authored, temporary: listTemporaryLights(campaignId, sceneId) };
}
