import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTilePlacements } from './useTilePlacements';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makePlacement(overrides?: Record<string, unknown>) {
  return {
    id: 'p-1',
    sceneId: 'scene-1',
    assetId: 'asset-1',
    campaignId: 'campaign-1',
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    rotation: 0,
    zIndex: 0,
    category: 'background',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useTilePlacements', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches placements on mount', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makePlacement()] }),
    });
    const { result } = renderHook(() => useTilePlacements('campaign-1', 'scene-1'));
    await waitFor(() => expect(result.current.placements).toHaveLength(1));
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/campaigns/campaign-1/scenes/scene-1/placements',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('returns empty array when campaignId or sceneId is undefined', () => {
    const { result } = renderHook(() => useTilePlacements(undefined, undefined));
    expect(result.current.placements).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('createPlacement posts to the API and adds to local state', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: makePlacement({ id: 'p-new' }) }),
      });
    const { result } = renderHook(() => useTilePlacements('campaign-1', 'scene-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdId: string | undefined;
    await act(async () => {
      const c = await result.current.createPlacement({
        assetId: 'asset-1',
        x: 10,
        y: 20,
        width: 64,
        height: 64,
        rotation: 0,
        zIndex: 0,
        category: 'background',
      });
      createdId = (c as { id?: string } | null)?.id;
    });
    expect(createdId).toBe('p-new');
    expect(result.current.placements.some((p) => p.id === 'p-new')).toBe(true);
  });

  it('updatePlacement applies optimistic update immediately', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makePlacement()] }),
    });
    const { result } = renderHook(() => useTilePlacements('campaign-1', 'scene-1'));
    await waitFor(() => expect(result.current.placements).toHaveLength(1));

    // Switch to fake timers only after real fetch resolves
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: makePlacement({ x: 100 }) }),
    });

    act(() => {
      result.current.updatePlacement('p-1', { x: 100 });
    });

    // Optimistic update should be immediate
    expect(result.current.placements[0].x).toBe(100);
    vi.runAllTimers();
  });

  it('updatePlacement debounces the API call', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makePlacement()] }),
    });
    const { result } = renderHook(() => useTilePlacements('campaign-1', 'scene-1'));
    await waitFor(() => expect(result.current.placements).toHaveLength(1));

    // Switch to fake timers after initial fetch
    vi.useFakeTimers();

    const patchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if ((opts as RequestInit | undefined)?.method === 'PATCH') return patchMock(url, opts);
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [makePlacement()] }),
      });
    });

    act(() => {
      result.current.updatePlacement('p-1', { x: 50 });
      result.current.updatePlacement('p-1', { x: 100 });
    });

    expect(patchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.runAllTimers();
    });

    expect(patchMock).toHaveBeenCalledTimes(1);
  });

  it('deletePlacement removes from local state optimistically', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [makePlacement()] }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });

    const { result } = renderHook(() => useTilePlacements('campaign-1', 'scene-1'));
    await waitFor(() => expect(result.current.placements).toHaveLength(1));

    await act(async () => {
      await result.current.deletePlacement('p-1');
    });

    expect(result.current.placements).toHaveLength(0);
  });
});
