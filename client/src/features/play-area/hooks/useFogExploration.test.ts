import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FogExplorationStamp } from '@vtt/shared';

import { useFogExploration } from './useFogExploration';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeStamp(overrides?: Partial<FogExplorationStamp>): FogExplorationStamp {
  return {
    id: '2:3:6',
    x: 160,
    y: 224,
    radius: 384,
    sceneId: 'scene-1',
    campaignId: 'campaign-1',
    ...overrides,
  };
}

describe('useFogExploration', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('rehydrates persisted exploration for the scene', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [makeStamp()] }) });

    const { result } = renderHook(() => useFogExploration('campaign-1', 'scene-1'));

    await waitFor(() => {
      expect(result.current.stamps).toEqual([{ id: '2:3:6', x: 160, y: 224, radius: 384 }]);
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/campaigns/campaign-1/scenes/scene-1/fog/exploration',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('merges an append delta into the local set', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [makeStamp()] }) });

    const { result } = renderHook(() => useFogExploration('campaign-1', 'scene-1'));
    await waitFor(() => {
      expect(result.current.stamps).toHaveLength(1);
    });

    act(() => {
      result.current.applyRemoteSync({
        campaignId: 'campaign-1',
        sceneId: 'scene-1',
        mode: 'append',
        stamps: [makeStamp({ id: '9:9' })],
      });
    });

    await waitFor(() => {
      expect(result.current.stamps.map((s) => s.id)).toEqual(['2:3:6', '9:9']);
    });
  });

  it('ignores an append delta that is already known', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [makeStamp()] }) });

    const { result } = renderHook(() => useFogExploration('campaign-1', 'scene-1'));
    await waitFor(() => {
      expect(result.current.stamps).toHaveLength(1);
    });

    act(() => {
      result.current.applyRemoteSync({
        campaignId: 'campaign-1',
        sceneId: 'scene-1',
        mode: 'append',
        stamps: [makeStamp()],
      });
    });

    expect(result.current.stamps).toHaveLength(1);
  });

  it('swaps the whole set on a replace sync', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [makeStamp()] }) });

    const { result } = renderHook(() => useFogExploration('campaign-1', 'scene-1'));
    await waitFor(() => {
      expect(result.current.stamps).toHaveLength(1);
    });

    act(() => {
      result.current.applyRemoteSync({
        campaignId: 'campaign-1',
        sceneId: 'scene-1',
        mode: 'replace',
        stamps: [],
      });
    });

    await waitFor(() => {
      expect(result.current.stamps).toEqual([]);
    });
  });

  it('clears exploration through the DM reset endpoint', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [makeStamp()] }) });

    const { result } = renderHook(() => useFogExploration('campaign-1', 'scene-1'));
    await waitFor(() => {
      expect(result.current.stamps).toHaveLength(1);
    });

    mockFetch.mockResolvedValueOnce({ ok: true });
    await act(async () => {
      await result.current.resetExploration();
    });

    await waitFor(() => {
      expect(result.current.stamps).toEqual([]);
    });
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/campaigns/campaign-1/scenes/scene-1/fog/exploration',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('skips fetching when no scene is active', async () => {
    const { result } = renderHook(() => useFogExploration(undefined, undefined));

    await waitFor(() => {
      expect(result.current.stamps).toEqual([]);
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
