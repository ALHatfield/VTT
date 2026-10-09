import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LightSource } from '@vtt/shared';

import { LIGHT_UPDATE_DEBOUNCE_MS, useLightSources } from './useLightSources';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const URL_BASE = '/api/campaigns/c1/scenes/s1/lights';

function makeLight(overrides: Partial<LightSource> = {}): LightSource {
  return {
    id: 'l1',
    sceneId: 's1',
    campaignId: 'c1',
    x: 0,
    y: 0,
    radius: 4,
    color: '#ffffff',
    intensity: 0.7,
    falloff: 0.5,
    emitterType: 'custom',
    animationMode: 'none',
    animationSeed: 7,
    alwaysVisible: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function ok(data: unknown): { ok: true; status: number; json: () => Promise<unknown> } {
  return { ok: true, status: 200, json: async () => ({ data }) };
}

function fail(status: number, message: string): object {
  return { ok: false, status, json: async () => ({ error: { message } }) };
}

async function mountWith(lights: LightSource[]) {
  mockFetch.mockResolvedValueOnce(ok(lights));
  const hook = renderHook(() => useLightSources('c1', 's1', true));
  await waitFor(() => expect(hook.result.current.lights).toHaveLength(lights.length));
  return hook;
}

function patchCalls(): unknown[][] {
  return mockFetch.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
  );
}

describe('useLightSources', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fetch when disabled (non-DM)', () => {
    const { result } = renderHook(() => useLightSources('c1', 's1', false));
    expect(result.current.lights).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('loads lights for the scene', async () => {
    await mountWith([makeLight()]);
    expect(mockFetch).toHaveBeenCalledWith(
      URL_BASE,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('creates a light from a preset payload without duplicating a refreshed copy', async () => {
    const { result } = await mountWith([]);
    const created = makeLight({ id: 'new', emitterType: 'torch' });

    mockFetch.mockResolvedValueOnce(ok([created]));
    await act(() => result.current.refresh());
    mockFetch.mockResolvedValueOnce({ ...ok(created), status: 201 });
    await act(async () => {
      await result.current.createLight({ emitterType: 'torch', x: 0, y: 0 });
    });

    expect(result.current.lights).toEqual([created]);
    expect(mockFetch).toHaveBeenLastCalledWith(
      URL_BASE,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ emitterType: 'torch', x: 0, y: 0 }),
      }),
    );
  });

  it('applies updates immediately and sends one merged PATCH after the debounce', async () => {
    const { result } = await mountWith([makeLight()]);
    vi.useFakeTimers();

    act(() => {
      result.current.updateLight('l1', { intensity: 0.2 });
      result.current.updateLight('l1', { intensity: 0.3 });
      result.current.updateLight('l1', { radius: 6 });
    });
    expect(result.current.lights[0]).toMatchObject({ intensity: 0.3, radius: 6 });
    expect(patchCalls()).toHaveLength(0);

    mockFetch.mockResolvedValueOnce(ok(makeLight({ intensity: 0.3, radius: 6 })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIGHT_UPDATE_DEBOUNCE_MS);
    });

    const patches = patchCalls();
    expect(patches).toHaveLength(1);
    expect(patches[0][0]).toBe(`${URL_BASE}/l1`);
    expect(JSON.parse((patches[0][1] as RequestInit).body as string)).toEqual({
      intensity: 0.3,
      radius: 6,
    });
  });

  it('keeps unsent edits on top of a refresh', async () => {
    const { result } = await mountWith([makeLight()]);
    vi.useFakeTimers();

    act(() => result.current.updateLight('l1', { color: '#00ff00' }));
    mockFetch.mockResolvedValueOnce(ok([makeLight({ color: '#ffffff' })]));
    await act(() => result.current.refresh());

    expect(result.current.lights[0].color).toBe('#00ff00');
  });

  it('keeps an in-flight edit on top of a refresh that returns older data', async () => {
    const { result } = await mountWith([makeLight()]);
    vi.useFakeTimers();

    let resolvePatch: (value: unknown) => void = () => undefined;
    mockFetch.mockReturnValueOnce(new Promise((resolve) => (resolvePatch = resolve)));
    act(() => result.current.updateLight('l1', { radius: 12 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIGHT_UPDATE_DEBOUNCE_MS);
    });

    mockFetch.mockResolvedValueOnce(ok([makeLight({ radius: 4 })]));
    await act(() => result.current.refresh());
    expect(result.current.lights[0].radius).toBe(12);

    await act(async () => {
      resolvePatch(ok(makeLight({ radius: 12 })));
    });
    expect(result.current.lights[0].radius).toBe(12);
  });

  it('flushes pending edits to the previous scene when the scene changes', async () => {
    mockFetch.mockResolvedValueOnce(ok([makeLight()]));
    const { result, rerender } = renderHook(
      ({ sceneId }: { sceneId: string }) => useLightSources('c1', sceneId, true),
      { initialProps: { sceneId: 's1' } },
    );
    await waitFor(() => expect(result.current.lights).toHaveLength(1));

    act(() => result.current.updateLight('l1', { intensity: 0.1 }));
    mockFetch.mockResolvedValue(ok([]));
    rerender({ sceneId: 's2' });

    const patches = patchCalls();
    expect(patches).toHaveLength(1);
    expect(patches[0][0]).toBe(`${URL_BASE}/l1`);
  });

  it('flushes pending edits on unmount', async () => {
    const { result, unmount } = await mountWith([makeLight()]);
    vi.useFakeTimers();

    act(() => result.current.updateLight('l1', { falloff: 0.9 }));
    mockFetch.mockResolvedValueOnce(ok(makeLight({ falloff: 0.9 })));
    unmount();

    expect(patchCalls()).toHaveLength(1);
  });

  it('cancels a pending edit when the light is deleted', async () => {
    const { result } = await mountWith([makeLight()]);
    vi.useFakeTimers();

    act(() => result.current.updateLight('l1', { falloff: 0.9 }));
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    await act(() => result.current.deleteLight('l1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIGHT_UPDATE_DEBOUNCE_MS);
    });

    expect(result.current.lights).toEqual([]);
    expect(patchCalls()).toHaveLength(0);
  });

  it('rolls back a failed delete and surfaces the error', async () => {
    const { result } = await mountWith([makeLight()]);

    mockFetch.mockResolvedValueOnce(fail(500, 'boom')).mockResolvedValueOnce(ok([makeLight()]));
    await act(() => result.current.deleteLight('l1'));

    await waitFor(() => expect(result.current.lights).toHaveLength(1));
    expect(result.current.error).toBe('boom');
  });
});
