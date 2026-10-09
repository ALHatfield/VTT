// Temporary light store — Phase PM4
// Session-scoped DM encounter lights. Held in memory only; a server restart clears them.
import { randomInt, randomUUID } from 'node:crypto';

import type {
    LightSourceUpdatePayload,
    TemporaryLight,
    TemporaryLightCreatePayload,
} from '@vtt/shared';
import {
    LIGHT_ANIMATION_SEED_MAX,
    LIGHT_PRESETS,
    MAX_TEMPORARY_LIGHTS_PER_SCENE,
} from '@vtt/shared';

export class TemporaryLightLimitError extends Error {
  constructor() {
    super(`A scene may contain at most ${MAX_TEMPORARY_LIGHTS_PER_SCENE} temporary lights`);
    this.name = 'TemporaryLightLimitError';
  }
}

/** campaignId:sceneId → lightId → light (insertion order preserved). */
const store = new Map<string, Map<string, TemporaryLight>>();

function sceneKey(campaignId: string, sceneId: string): string {
  return `${campaignId}:${sceneId}`;
}

export function listTemporaryLights(campaignId: string, sceneId: string): TemporaryLight[] {
  return [...(store.get(sceneKey(campaignId, sceneId))?.values() ?? [])];
}

/** Throws TemporaryLightLimitError when the scene is at capacity. */
export function createTemporaryLight(
  payload: TemporaryLightCreatePayload,
  createdBy: string,
): TemporaryLight {
  const key = sceneKey(payload.campaignId, payload.sceneId);
  const lights = store.get(key) ?? new Map<string, TemporaryLight>();
  if (lights.size >= MAX_TEMPORARY_LIGHTS_PER_SCENE) throw new TemporaryLightLimitError();

  const preset = LIGHT_PRESETS[payload.emitterType];
  const light: TemporaryLight = {
    id: randomUUID(),
    campaignId: payload.campaignId,
    sceneId: payload.sceneId,
    x: payload.x,
    y: payload.y,
    radius: payload.radius ?? preset.radius,
    color: payload.color ?? preset.color,
    intensity: payload.intensity ?? preset.intensity,
    falloff: payload.falloff ?? preset.falloff,
    emitterType: payload.emitterType,
    animationMode: payload.animationMode ?? preset.animationMode,
    animationSeed: randomInt(LIGHT_ANIMATION_SEED_MAX),
    createdBy,
    createdAt: new Date().toISOString(),
  };
  lights.set(light.id, light);
  store.set(key, lights);
  return light;
}

/** Returns null when the light does not exist on this scene. */
export function updateTemporaryLight(
  campaignId: string,
  sceneId: string,
  lightId: string,
  changes: LightSourceUpdatePayload,
): TemporaryLight | null {
  const lights = store.get(sceneKey(campaignId, sceneId));
  const existing = lights?.get(lightId);
  if (!lights || !existing) return null;
  const updated: TemporaryLight = { ...existing, ...changes };
  lights.set(lightId, updated);
  return updated;
}

/** Returns false when the light does not exist on this scene. */
export function deleteTemporaryLight(campaignId: string, sceneId: string, lightId: string): boolean {
  const key = sceneKey(campaignId, sceneId);
  const lights = store.get(key);
  if (!lights?.delete(lightId)) return false;
  if (lights.size === 0) store.delete(key);
  return true;
}

/** Test helper — wipes all temporary lights. */
export function resetTemporaryLights(): void {
  store.clear();
}
