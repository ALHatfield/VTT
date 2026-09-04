import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FogMaskConfig } from '@vtt/shared';
import { DEFAULT_FOG_MASK_CONFIG } from '@vtt/shared';

import { useFogConfig } from './useFogConfig';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeConfig(overrides?: Partial<FogMaskConfig>): FogMaskConfig {
  return { ...DEFAULT_FOG_MASK_CONFIG, ...overrides };
}

describe('useFogConfig', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('loads the scene fog config from the REST endpoint', async () => {
    const config = makeConfig({ fogMode: 'pm2', explorationMode: 'persistent' });
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: config }) });

    const { result } = renderHook(() => useFogConfig('campaign-1', 'scene-1'));

    await waitFor(() => {
      expect(result.current.config.fogMode).toBe('pm2');
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/campaigns/campaign-1/scenes/scene-1/fog/config',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('falls back to defaults when no scene is active', async () => {
    const { result } = renderHook(() => useFogConfig(undefined, undefined));

    await waitFor(() => {
      expect(result.current.config).toEqual(DEFAULT_FOG_MASK_CONFIG);
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('surfaces a load error without clobbering the current config', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Scene not found' } }),
    });

    const { result } = renderHook(() => useFogConfig('campaign-1', 'scene-1'));

    await waitFor(() => {
      expect(result.current.error).toBe('Scene not found');
    });
    expect(result.current.config).toEqual(DEFAULT_FOG_MASK_CONFIG);
  });

  it('persists a patch and adopts the server-normalized result', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: makeConfig() }) });

    const { result } = renderHook(() => useFogConfig('campaign-1', 'scene-1'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const updated = makeConfig({ fogMode: 'pm2', maskResolutionScale: 0.25 });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: updated }) });

    await act(async () => {
      await result.current.updateConfig({ fogMode: 'pm2' });
    });

    await waitFor(() => {
      expect(result.current.config.maskResolutionScale).toBe(0.25);
    });
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/campaigns/campaign-1/scenes/scene-1/fog/config',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('applies a broadcast config from another client', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: makeConfig() }) });

    const { result } = renderHook(() => useFogConfig('campaign-1', 'scene-1'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.applyRemoteConfig(makeConfig({ edgeSoftness: 'radial' }));
    });

    await waitFor(() => {
      expect(result.current.config.edgeSoftness).toBe('radial');
    });
  });
});
