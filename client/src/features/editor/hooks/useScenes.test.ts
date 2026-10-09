// useScenes tests — Phase 5H
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SceneSummary } from '@vtt/shared';

import { useScenes } from './useScenes';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeScene(overrides: Partial<SceneSummary> = {}): SceneSummary {
  return {
    id: 's-1',
    campaignId: 'c-1',
    name: 'Scene 1',
    imageUrl: null,
    width: 2048,
    height: 2048,
    cellSize: 64,
    isActive: true,
    sortOrder: 0,
    thumbnailUrl: null,
    weatherPreset: 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function okJson(data: unknown): { ok: true; json: () => Promise<unknown> } {
  return { ok: true, json: async () => ({ data }) };
}

describe('useScenes', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('fetches the scene list when enabled', async () => {
    mockFetch.mockResolvedValue(okJson([makeScene()]));
    const { result } = renderHook(() => useScenes('c-1', true));
    await waitFor(() => expect(result.current.scenes).toHaveLength(1));
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/campaigns/c-1/scenes',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('does not fetch when disabled (players never see the scene list)', () => {
    const { result } = renderHook(() => useScenes('c-1', false));
    expect(result.current.scenes).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('createScene appends the created scene', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson([makeScene()]))
      .mockResolvedValueOnce(okJson(makeScene({ id: 's-2', name: 'Scene 2', sortOrder: 1 })));
    const { result } = renderHook(() => useScenes('c-1', true));
    await waitFor(() => expect(result.current.scenes).toHaveLength(1));

    await act(async () => {
      const created = await result.current.createScene({ name: 'Scene 2' });
      expect(created?.id).toBe('s-2');
    });
    expect(result.current.scenes.map((s) => s.id)).toEqual(['s-1', 's-2']);
  });

  it('updateScene applies an optimistic rename and reconciles with the server', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson([makeScene()]))
      .mockResolvedValueOnce(okJson(makeScene({ name: 'Renamed' })));
    const { result } = renderHook(() => useScenes('c-1', true));
    await waitFor(() => expect(result.current.scenes).toHaveLength(1));

    await act(async () => {
      await result.current.updateScene('s-1', { name: 'Renamed' });
    });
    expect(result.current.scenes[0].name).toBe('Renamed');
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/campaigns/c-1/scenes/s-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('deleteScene removes the scene on success', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson([makeScene(), makeScene({ id: 's-2', isActive: false })]))
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const { result } = renderHook(() => useScenes('c-1', true));
    await waitFor(() => expect(result.current.scenes).toHaveLength(2));

    await act(async () => {
      expect(await result.current.deleteScene('s-2')).toBe(true);
    });
    expect(result.current.scenes.map((s) => s.id)).toEqual(['s-1']);
  });

  it('deleteScene surfaces server rejections (active scene guard)', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson([makeScene()]))
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: { code: 'SCENE_ACTIVE', message: 'The active scene cannot be deleted' },
        }),
      });
    const { result } = renderHook(() => useScenes('c-1', true));
    await waitFor(() => expect(result.current.scenes).toHaveLength(1));

    await act(async () => {
      expect(await result.current.deleteScene('s-1')).toBe(false);
    });
    expect(result.current.scenes).toHaveLength(1);
    expect(result.current.error).toBe('The active scene cannot be deleted');
  });

  it('duplicateScene appends the copy', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson([makeScene()]))
      .mockResolvedValueOnce(
        okJson(makeScene({ id: 's-copy', name: 'Scene 1 (copy)', isActive: false, sortOrder: 1 })),
      );
    const { result } = renderHook(() => useScenes('c-1', true));
    await waitFor(() => expect(result.current.scenes).toHaveLength(1));

    await act(async () => {
      const copy = await result.current.duplicateScene('s-1');
      expect(copy?.name).toBe('Scene 1 (copy)');
    });
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/campaigns/c-1/scenes/s-1/duplicate',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.scenes).toHaveLength(2);
  });

  it('reorderScenes applies the order optimistically and syncs with the server response', async () => {
    const a = makeScene({ id: 's-a', sortOrder: 0 });
    const b = makeScene({ id: 's-b', isActive: false, sortOrder: 1 });
    mockFetch.mockResolvedValueOnce(okJson([a, b])).mockResolvedValueOnce(
      okJson([
        { ...b, sortOrder: 0 },
        { ...a, sortOrder: 1 },
      ]),
    );
    const { result } = renderHook(() => useScenes('c-1', true));
    await waitFor(() => expect(result.current.scenes).toHaveLength(2));

    await act(async () => {
      await result.current.reorderScenes(['s-b', 's-a']);
    });
    expect(result.current.scenes.map((s) => s.id)).toEqual(['s-b', 's-a']);
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/campaigns/c-1/scenes/order',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ sceneIds: ['s-b', 's-a'] }),
      }),
    );
  });

  it('reorderScenes re-syncs from the server on failure', async () => {
    const a = makeScene({ id: 's-a', sortOrder: 0 });
    const b = makeScene({ id: 's-b', isActive: false, sortOrder: 1 });
    mockFetch
      .mockResolvedValueOnce(okJson([a, b]))
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'bad order' } }),
      })
      .mockResolvedValueOnce(okJson([a, b]));
    const { result } = renderHook(() => useScenes('c-1', true));
    await waitFor(() => expect(result.current.scenes).toHaveLength(2));

    await act(async () => {
      await result.current.reorderScenes(['s-b', 's-a']);
    });
    await waitFor(() => expect(result.current.scenes.map((s) => s.id)).toEqual(['s-a', 's-b']));
    expect(result.current.error).toBe('bad order');
  });

  it('uploadThumbnail PUTs form data and applies the updated scene', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson([makeScene()]))
      .mockResolvedValueOnce(
        okJson(makeScene({ thumbnailUrl: '/uploads/thumbnails/scene-thumb_s-1_1.webp' })),
      );
    const { result } = renderHook(() => useScenes('c-1', true));
    await waitFor(() => expect(result.current.scenes).toHaveLength(1));

    await act(async () => {
      await result.current.uploadThumbnail('s-1', new Blob(['x'], { type: 'image/webp' }));
    });
    expect(result.current.scenes[0].thumbnailUrl).toBe(
      '/uploads/thumbnails/scene-thumb_s-1_1.webp',
    );
    const [url, init] = mockFetch.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe('/api/campaigns/c-1/scenes/s-1/thumbnail');
    expect(init.method).toBe('PUT');
    expect(init.body).toBeInstanceOf(FormData);
  });
});
