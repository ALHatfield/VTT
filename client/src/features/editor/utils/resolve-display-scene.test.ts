// resolve-display-scene tests — Phase 5H (edited-vs-active scene isolation)
import { describe, expect, it } from 'vitest';

import type { SceneSummary } from '@vtt/shared';

import type { DisplayScene } from './resolve-display-scene';
import { resolveDisplayScene } from './resolve-display-scene';

function makeSummary(overrides: Partial<SceneSummary> = {}): SceneSummary {
  return {
    id: 's-1',
    campaignId: 'c-1',
    name: 'Scene 1',
    imageUrl: null,
    width: 2048,
    height: 2048,
    cellSize: 64,
    isActive: false,
    sortOrder: 0,
    thumbnailUrl: null,
    weatherPreset: 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const activeScene: DisplayScene = {
  id: 's-active',
  campaignId: 'c-1',
  name: 'Active',
  imageUrl: null,
  width: 2048,
  height: 2048,
  cellSize: 64,
  isActive: true,
};

describe('resolveDisplayScene', () => {
  it('returns the active scene in play mode regardless of the edited selection', () => {
    const result = resolveDisplayScene({
      isEditorMode: false,
      isDm: true,
      scenes: [makeSummary({ id: 's-other' })],
      editedSceneId: 's-other',
      activeScene,
    });
    expect(result?.id).toBe('s-active');
  });

  it('returns the active scene for non-DMs even in editor mode', () => {
    const result = resolveDisplayScene({
      isEditorMode: true,
      isDm: false,
      scenes: [makeSummary({ id: 's-other' })],
      editedSceneId: 's-other',
      activeScene,
    });
    expect(result?.id).toBe('s-active');
  });

  it('returns the edited scene for the DM in editor mode', () => {
    const edited = makeSummary({ id: 's-other', name: 'Prep Room' });
    const result = resolveDisplayScene({
      isEditorMode: true,
      isDm: true,
      scenes: [edited],
      editedSceneId: 's-other',
      activeScene,
    });
    expect(result?.id).toBe('s-other');
    expect(result?.name).toBe('Prep Room');
  });

  it('falls back to the active scene when no edited scene is selected', () => {
    const result = resolveDisplayScene({
      isEditorMode: true,
      isDm: true,
      scenes: [makeSummary({ id: 's-other' })],
      editedSceneId: null,
      activeScene,
    });
    expect(result?.id).toBe('s-active');
  });

  it('falls back to the active scene when the edited scene was deleted from the list', () => {
    const result = resolveDisplayScene({
      isEditorMode: true,
      isDm: true,
      scenes: [makeSummary({ id: 's-other' })],
      editedSceneId: 's-gone',
      activeScene,
    });
    expect(result?.id).toBe('s-active');
  });

  it('returns null when nothing is available', () => {
    const result = resolveDisplayScene({
      isEditorMode: true,
      isDm: true,
      scenes: [],
      editedSceneId: null,
      activeScene: null,
    });
    expect(result).toBeNull();
  });
});
