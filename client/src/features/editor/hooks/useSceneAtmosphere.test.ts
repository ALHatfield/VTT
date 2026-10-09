import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSceneAtmosphere } from './useSceneAtmosphere';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function ok(data: unknown): object {
  return { ok: true, status: 200, json: async () => ({ data }) };
}

function fail(status: number, message: string): object {
  return { ok: false, status, json: async () => ({ error: { message } }) };
}

describe('useSceneAtmosphere', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useSceneAtmosphere('c1', 's1', false));
    expect(result.current.weatherPreset).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('loads the preset and saves changes optimistically', async () => {
    mockFetch.mockResolvedValueOnce(ok({ weatherPreset: 'rain' }));
    const { result } = renderHook(() => useSceneAtmosphere('c1', 's1', true));
    await waitFor(() => expect(result.current.weatherPreset).toBe('rain'));

    mockFetch.mockResolvedValueOnce(ok({ weatherPreset: 'snow' }));
    await act(() => result.current.setWeatherPreset('snow'));

    expect(result.current.weatherPreset).toBe('snow');
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/campaigns/c1/scenes/s1/atmosphere',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ weatherPreset: 'snow' }) }),
    );
  });

  it('re-syncs from the server when a save fails', async () => {
    mockFetch.mockResolvedValueOnce(ok({ weatherPreset: 'none' }));
    const { result } = renderHook(() => useSceneAtmosphere('c1', 's1', true));
    await waitFor(() => expect(result.current.weatherPreset).toBe('none'));

    mockFetch
      .mockResolvedValueOnce(fail(500, 'boom'))
      .mockResolvedValueOnce(ok({ weatherPreset: 'haze' }));
    await act(() => result.current.setWeatherPreset('rain'));

    await waitFor(() => expect(result.current.weatherPreset).toBe('haze'));
    expect(result.current.error).toBe('boom');
  });

  it('ignores a superseded save that fails', async () => {
    mockFetch.mockResolvedValueOnce(ok({ weatherPreset: 'none' }));
    const { result } = renderHook(() => useSceneAtmosphere('c1', 's1', true));
    await waitFor(() => expect(result.current.weatherPreset).toBe('none'));

    let rejectFirst: (value: unknown) => void = () => undefined;
    mockFetch.mockReturnValueOnce(new Promise((resolve) => (rejectFirst = resolve)));
    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.setWeatherPreset('rain');
    });
    mockFetch.mockResolvedValueOnce(ok({ weatherPreset: 'snow' }));
    await act(() => result.current.setWeatherPreset('snow'));

    await act(async () => {
      rejectFirst(fail(500, 'late failure'));
      await first;
    });

    expect(result.current.weatherPreset).toBe('snow');
    expect(result.current.error).toBeNull();
  });
});
