import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WallSegment } from '@vtt/shared';

import { useWallSegments } from './useWallSegments';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const URL_BASE = '/api/campaigns/c1/scenes/s1/walls';

function makeWall(overrides: Partial<WallSegment> = {}): WallSegment {
  return {
    id: 'w1',
    sceneId: 's1',
    campaignId: 'c1',
    x1: 0,
    y1: 0,
    x2: 64,
    y2: 0,
    blocksLight: true,
    blocksMovement: true,
    isDoor: false,
    isOpen: false,
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

async function mountWith(walls: WallSegment[]) {
  mockFetch.mockResolvedValueOnce(ok(walls));
  const hook = renderHook(() => useWallSegments('c1', 's1', true));
  await waitFor(() => expect(hook.result.current.walls).toHaveLength(walls.length));
  return hook;
}

describe('useWallSegments', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('does not fetch when disabled (non-DM)', () => {
    const { result } = renderHook(() => useWallSegments('c1', 's1', false));
    expect(result.current.walls).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('loads walls for the scene', async () => {
    await mountWith([makeWall()]);
    expect(mockFetch).toHaveBeenCalledWith(URL_BASE, expect.objectContaining({ credentials: 'include' }));
  });

  it('does not duplicate a created wall already added by a refresh', async () => {
    const { result } = await mountWith([]);
    const created = makeWall({ id: 'new' });

    mockFetch.mockResolvedValueOnce(ok([created]));
    await act(() => result.current.refresh());
    mockFetch.mockResolvedValueOnce({ ...ok(created), status: 201 });
    await act(async () => {
      await result.current.createWall({ x1: 0, y1: 0, x2: 64, y2: 0 });
    });

    expect(result.current.walls).toEqual([created]);
  });

  it('discards a refetch that was in flight when a local edit started', async () => {
    const { result } = await mountWith([makeWall()]);

    let resolveStale: (value: unknown) => void = () => undefined;
    mockFetch.mockReturnValueOnce(new Promise((resolve) => (resolveStale = resolve)));
    let refreshPromise: Promise<void> = Promise.resolve();
    act(() => {
      refreshPromise = result.current.refresh();
    });

    mockFetch.mockResolvedValueOnce(ok(makeWall({ isDoor: true })));
    await act(() => result.current.updateWall('w1', { isDoor: true }));

    await act(async () => {
      resolveStale(ok([makeWall({ isDoor: false })]));
      await refreshPromise;
    });

    expect(result.current.walls[0].isDoor).toBe(true);
  });

  it('rolls back an optimistic delete that fails and clears the error on the next action', async () => {
    const { result } = await mountWith([makeWall()]);

    mockFetch
      .mockResolvedValueOnce(fail(500, 'boom'))
      .mockResolvedValueOnce(ok([makeWall()]));
    await act(() => result.current.deleteWall('w1'));

    await waitFor(() => expect(result.current.walls).toHaveLength(1));
    expect(result.current.error).toBe('boom');

    mockFetch.mockResolvedValueOnce(ok(makeWall({ blocksLight: false })));
    await act(() => result.current.updateWall('w1', { blocksLight: false }));
    expect(result.current.error).toBeNull();
  });

  it('bulk delete clears walls optimistically', async () => {
    const { result } = await mountWith([makeWall(), makeWall({ id: 'w2' })]);

    mockFetch.mockResolvedValueOnce(ok({ deletedCount: 2 }));
    await act(() => result.current.deleteAllWalls());

    expect(result.current.walls).toEqual([]);
    expect(mockFetch).toHaveBeenLastCalledWith(
      URL_BASE,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
