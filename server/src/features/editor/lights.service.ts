// Light source + scene atmosphere service — Phase 5G
import { randomInt } from 'node:crypto';

import type {
    LightSource,
    LightSourceCreatePayload,
    LightSourceUpdatePayload,
    SceneAtmosphere,
    WeatherPreset,
} from '@vtt/shared';
import { LIGHT_ANIMATION_SEED_MAX, LIGHT_PRESETS, MAX_LIGHTS_PER_SCENE } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';

export type LightErrorCode = 'SCENE_NOT_FOUND' | 'LIGHT_LIMIT_REACHED';

export class LightServiceError extends Error {
  constructor(
    readonly code: LightErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LightServiceError';
  }
}

const LIGHT_SELECT = {
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
} as const;

interface LightRow extends Omit<LightSource, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

function toLightSource(row: LightRow): LightSource {
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
  if (!scene) throw new LightServiceError('SCENE_NOT_FOUND', 'Scene not found');
}

/** List all authored lights on a scene. Throws SCENE_NOT_FOUND for foreign scenes. */
export async function listLights(campaignId: string, sceneId: string): Promise<LightSource[]> {
  await assertSceneBelongsToCampaign(campaignId, sceneId);
  const rows = await prisma.lightSource.findMany({
    where: { campaignId, sceneId },
    select: LIGHT_SELECT,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map(toLightSource);
}

/**
 * Create a light, filling omitted fields from the emitter type's preset and
 * assigning an animation seed. Throws SCENE_NOT_FOUND or LIGHT_LIMIT_REACHED.
 */
export async function createLight(
  campaignId: string,
  sceneId: string,
  payload: LightSourceCreatePayload,
): Promise<LightSource> {
  await assertSceneBelongsToCampaign(campaignId, sceneId);

  const count = await prisma.lightSource.count({ where: { campaignId, sceneId } });
  if (count >= MAX_LIGHTS_PER_SCENE) {
    throw new LightServiceError(
      'LIGHT_LIMIT_REACHED',
      `A scene may contain at most ${MAX_LIGHTS_PER_SCENE} lights`,
    );
  }

  const { radius, color, intensity, falloff, animationMode } = LIGHT_PRESETS[payload.emitterType];
  const row = await prisma.lightSource.create({
    data: {
      radius,
      color,
      intensity,
      falloff,
      animationMode,
      ...payload,
      animationSeed: randomInt(LIGHT_ANIMATION_SEED_MAX),
      campaignId,
      sceneId,
    },
    select: LIGHT_SELECT,
  });
  return toLightSource(row);
}

/** Update a light. Returns null when not found in this campaign/scene. */
export async function updateLight(
  campaignId: string,
  sceneId: string,
  lightId: string,
  payload: LightSourceUpdatePayload,
): Promise<LightSource | null> {
  const { count } = await prisma.lightSource.updateMany({
    where: { id: lightId, campaignId, sceneId },
    data: payload,
  });
  if (count === 0) return null;

  const row = await prisma.lightSource.findFirst({
    where: { id: lightId, campaignId, sceneId },
    select: LIGHT_SELECT,
  });
  return row ? toLightSource(row) : null;
}

/** Delete one light. Returns false when not found in this campaign/scene. */
export async function deleteLight(
  campaignId: string,
  sceneId: string,
  lightId: string,
): Promise<boolean> {
  const { count } = await prisma.lightSource.deleteMany({
    where: { id: lightId, campaignId, sceneId },
  });
  return count > 0;
}

/** Read a scene's atmosphere settings. Throws SCENE_NOT_FOUND for foreign scenes. */
export async function getSceneAtmosphere(
  campaignId: string,
  sceneId: string,
): Promise<SceneAtmosphere> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, campaignId },
    select: { weatherPreset: true },
  });
  if (!scene) throw new LightServiceError('SCENE_NOT_FOUND', 'Scene not found');
  return { weatherPreset: scene.weatherPreset };
}

/** Set a scene's default weather preset. Throws SCENE_NOT_FOUND for foreign scenes. */
export async function updateSceneAtmosphere(
  campaignId: string,
  sceneId: string,
  weatherPreset: WeatherPreset,
): Promise<SceneAtmosphere> {
  const { count } = await prisma.scene.updateMany({
    where: { id: sceneId, campaignId },
    data: { weatherPreset },
  });
  if (count === 0) throw new LightServiceError('SCENE_NOT_FOUND', 'Scene not found');
  return { weatherPreset };
}
