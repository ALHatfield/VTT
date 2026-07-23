import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FogRegion } from '@vtt/shared';

import { useFogRegions } from './useFogRegions';

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

function makeRegion(overrides?: Partial<FogRegion>): FogRegion {
  return {
    id: 'fog-1',
    campaignId: 'campaign-1',
    sceneId: 'scene-1',
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useFogRegions', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('loads fog regions from the REST endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makeRegion()] }),
    });

    const { result } = renderHook(() => useFogRegions('campaign-1', 'scene-1'));

    await waitFor(() => {
      expect(result.current.regions).toHaveLength(1);
    });
  });

  it('adds remote reveal regions without duplicates', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const { result } = renderHook(() => useFogRegions('campaign-1', 'scene-1'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const region = makeRegion();

    act(() => {
      result.current.applyRemoteReveal(region);
      result.current.applyRemoteReveal(region);
    });

    expect(result.current.regions).toHaveLength(1);
  });

  it('removes regions by id on remote hide', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makeRegion(), makeRegion({ id: 'fog-2' })] }),
    });

    const { result } = renderHook(() => useFogRegions('campaign-1', 'scene-1'));
    await waitFor(() => {
      expect(result.current.regions).toHaveLength(2);
    });

    act(() => {
      result.current.applyRemoteHide(['fog-1']);
    });

    expect(result.current.regions).toHaveLength(1);
    expect(result.current.regions[0].id).toBe('fog-2');
  });
});
