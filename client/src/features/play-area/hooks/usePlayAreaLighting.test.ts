import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LightSource, SceneLighting, TemporaryLight } from '@vtt/shared';

import type { CanvasManager } from '../canvas/CanvasManager';
import { usePlayAreaLighting } from './usePlayAreaLighting';

const authored = { id: 'a1', animationSeed: 1 } as LightSource;
const temporary = { id: 't1', animationSeed: 2 } as TemporaryLight;

function mockCanvas(): CanvasManager & {
  setLights: ReturnType<typeof vi.fn>;
  setLightingReducedMotion: ReturnType<typeof vi.fn>;
} {
  return {
    setLights: vi.fn(),
    setLightingReducedMotion: vi.fn(),
  } as unknown as CanvasManager & {
    setLights: ReturnType<typeof vi.fn>;
    setLightingReducedMotion: ReturnType<typeof vi.fn>;
  };
}

describe('usePlayAreaLighting', () => {
  let matches = false;

  beforeEach(() => {
    matches = false;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { authored: [authored], temporary: [temporary] } satisfies { data: SceneLighting }['data'] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the member lighting endpoint and pushes merged lights to the canvas', async () => {
    const canvas = mockCanvas();
    renderHook(() =>
      usePlayAreaLighting({ campaignId: 'c1', sceneId: 's1', canvasManager: canvas, isReady: true }),
    );

    await waitFor(() => expect(canvas.setLights).toHaveBeenLastCalledWith([authored, temporary]));
    expect(fetch).toHaveBeenCalledWith('/api/campaigns/c1/scenes/s1/lighting', {
      credentials: 'include',
    });
  });

  it('replaces temporary lights from a socket snapshot for the active scene only', async () => {
    const canvas = mockCanvas();
    const { result } = renderHook(() =>
      usePlayAreaLighting({ campaignId: 'c1', sceneId: 's1', canvasManager: canvas, isReady: true }),
    );
    await waitFor(() => expect(result.current.temporaryLights).toEqual([temporary]));

    const other = { id: 't2' } as TemporaryLight;
    act(() => {
      result.current.handleTemporaryLightsUpdated({ campaignId: 'c1', sceneId: 'other', lights: [other] });
    });
    expect(result.current.temporaryLights).toEqual([temporary]);

    act(() => {
      result.current.handleTemporaryLightsUpdated({ campaignId: 'c1', sceneId: 's1', lights: [other] });
    });
    expect(result.current.temporaryLights).toEqual([other]);
    expect(canvas.setLights).toHaveBeenLastCalledWith([authored, other]);
  });

  it('only renders glows for lights the viewer can see (PM3)', async () => {
    const canvas = mockCanvas();
    const visibleLightIds = new Set(['t1']);
    renderHook(() =>
      usePlayAreaLighting({
        campaignId: 'c1',
        sceneId: 's1',
        canvasManager: canvas,
        isReady: true,
        visibleLightIds,
      }),
    );

    await waitFor(() => expect(canvas.setLights).toHaveBeenLastCalledWith([temporary]));
  });

  it('forwards prefers-reduced-motion to the canvas', () => {
    matches = true;
    const canvas = mockCanvas();
    renderHook(() =>
      usePlayAreaLighting({ campaignId: 'c1', sceneId: 's1', canvasManager: canvas, isReady: true }),
    );
    expect(canvas.setLightingReducedMotion).toHaveBeenCalledWith(true);
  });

  it('does not fetch without a scene', () => {
    renderHook(() =>
      usePlayAreaLighting({ campaignId: 'c1', sceneId: undefined, canvasManager: null, isReady: false }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
