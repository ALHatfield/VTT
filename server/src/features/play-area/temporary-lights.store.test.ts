import { afterEach, describe, expect, it } from 'vitest';

import { LIGHT_PRESETS, MAX_TEMPORARY_LIGHTS_PER_SCENE } from '@vtt/shared';

import {
    TemporaryLightLimitError,
    createTemporaryLight,
    deleteTemporaryLight,
    listTemporaryLights,
    resetTemporaryLights,
    updateTemporaryLight,
} from './temporary-lights.store.js';

const target = { campaignId: 'c1', sceneId: 's1' };

describe('temporary-lights.store', () => {
  afterEach(() => {
    resetTemporaryLights();
  });

  it('fills omitted fields from the emitter preset and assigns a seed', () => {
    const light = createTemporaryLight({ ...target, emitterType: 'fireplace', x: 5, y: 6 }, 'dm');
    const preset = LIGHT_PRESETS.fireplace;
    expect(light).toMatchObject({
      ...target,
      x: 5,
      y: 6,
      radius: preset.radius,
      color: preset.color,
      intensity: preset.intensity,
      falloff: preset.falloff,
      animationMode: preset.animationMode,
      createdBy: 'dm',
    });
    expect(Number.isInteger(light.animationSeed)).toBe(true);
  });

  it('serializes to plain JSON without loss', () => {
    const light = createTemporaryLight({ ...target, emitterType: 'torch', x: 1, y: 2, color: '#123456' }, 'dm');
    expect(JSON.parse(JSON.stringify(light))).toEqual(light);
  });

  it('scopes lights per scene', () => {
    createTemporaryLight({ ...target, emitterType: 'torch', x: 0, y: 0 }, 'dm');
    expect(listTemporaryLights('c1', 's1')).toHaveLength(1);
    expect(listTemporaryLights('c1', 's2')).toEqual([]);
  });

  it('updates and deletes, returning null/false for unknown ids', () => {
    const light = createTemporaryLight({ ...target, emitterType: 'torch', x: 0, y: 0 }, 'dm');
    expect(updateTemporaryLight('c1', 's1', light.id, { radius: 3 })?.radius).toBe(3);
    expect(updateTemporaryLight('c1', 's1', 'nope', { radius: 3 })).toBeNull();
    expect(deleteTemporaryLight('c1', 's1', light.id)).toBe(true);
    expect(deleteTemporaryLight('c1', 's1', light.id)).toBe(false);
    expect(listTemporaryLights('c1', 's1')).toEqual([]);
  });

  it('keeps the animation seed stable across updates', () => {
    const light = createTemporaryLight({ ...target, emitterType: 'torch', x: 0, y: 0 }, 'dm');
    expect(updateTemporaryLight('c1', 's1', light.id, { intensity: 0.1 })?.animationSeed).toBe(
      light.animationSeed,
    );
  });

  it('throws once the scene limit is reached', () => {
    for (let i = 0; i < MAX_TEMPORARY_LIGHTS_PER_SCENE; i++) {
      createTemporaryLight({ ...target, emitterType: 'torch', x: i, y: 0 }, 'dm');
    }
    expect(() => createTemporaryLight({ ...target, emitterType: 'torch', x: 0, y: 0 }, 'dm')).toThrow(
      TemporaryLightLimitError,
    );
  });
});
