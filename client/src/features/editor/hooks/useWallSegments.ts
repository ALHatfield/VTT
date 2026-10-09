// useWallSegments — Phase 5F
// DM-only REST CRUD for wall segments on a scene, with optimistic local state.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { WallSegment, WallSegmentCreatePayload, WallSegmentUpdatePayload } from '@vtt/shared';

import { editorSaveTracker } from '../utils/save-tracker';

interface UseWallSegmentsReturn {
  walls: WallSegment[];
  error: string | null;
  createWall: (payload: WallSegmentCreatePayload) => Promise<WallSegment | null>;
  updateWall: (wallId: string, payload: WallSegmentUpdatePayload) => Promise<void>;
  deleteWall: (wallId: string) => Promise<void>;
  deleteAllWalls: () => Promise<void>;
  refresh: () => Promise<void>;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return body.error?.message ?? `${fallback}: HTTP ${res.status}`;
}

export function useWallSegments(
  campaignId: string | undefined,
  sceneId: string | undefined,
  enabled: boolean,
): UseWallSegmentsReturn {
  const [walls, setWalls] = useState<WallSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Discards responses from superseded fetches, including any in flight when a local edit starts
  const fetchSeqRef = useRef(0);

  const baseUrl =
    enabled && campaignId && sceneId
      ? `/api/campaigns/${campaignId}/scenes/${sceneId}/walls`
      : null;
  const baseUrlRef = useRef(baseUrl);
  useEffect(() => {
    baseUrlRef.current = baseUrl;
  }, [baseUrl]);

  const beginMutation = useCallback((): void => {
    fetchSeqRef.current++;
    setError(null);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const seq = ++fetchSeqRef.current;
    if (!baseUrl) {
      setWalls([]);
      return;
    }
    try {
      const res = await fetch(baseUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to load walls'));
      const body = (await res.json()) as { data: WallSegment[] };
      if (seq === fetchSeqRef.current) setWalls(body.data);
    } catch (err: unknown) {
      if (seq === fetchSeqRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load walls');
      }
    }
  }, [baseUrl]);

  useEffect(() => {
    setWalls([]);
    void refresh();
  }, [refresh]);

  const createWall = useCallback(
    async (payload: WallSegmentCreatePayload): Promise<WallSegment | null> => {
      if (!baseUrl) return null;
      beginMutation();
      try {
        const { data } = await editorSaveTracker.track(async () => {
          const res = await fetch(baseUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to create wall'));
          return (await res.json()) as { data: WallSegment };
        });
        // The scene may have changed while the request was in flight
        if (baseUrlRef.current !== baseUrl) return data;
        // A socket-triggered refresh may already have added this wall
        setWalls((prev) => (prev.some((w) => w.id === data.id) ? prev : [...prev, data]));
        return data;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to create wall');
        return null;
      }
    },
    [baseUrl, beginMutation],
  );

  const updateWall = useCallback(
    async (wallId: string, payload: WallSegmentUpdatePayload): Promise<void> => {
      if (!baseUrl) return;
      beginMutation();
      setWalls((prev) => prev.map((w) => (w.id === wallId ? { ...w, ...payload } : w)));
      try {
        const { data } = await editorSaveTracker.track(async () => {
          const res = await fetch(`${baseUrl}/${wallId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to update wall'));
          return (await res.json()) as { data: WallSegment };
        });
        if (baseUrlRef.current !== baseUrl) return;
        setWalls((prev) => prev.map((w) => (w.id === wallId ? data : w)));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to update wall');
        void refresh();
      }
    },
    [baseUrl, beginMutation, refresh],
  );

  const deleteWall = useCallback(
    async (wallId: string): Promise<void> => {
      if (!baseUrl) return;
      beginMutation();
      setWalls((prev) => prev.filter((w) => w.id !== wallId));
      try {
        await editorSaveTracker.track(async () => {
          const res = await fetch(`${baseUrl}/${wallId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (!res.ok && res.status !== 404) {
            throw new Error(await readErrorMessage(res, 'Failed to delete wall'));
          }
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete wall');
        void refresh();
      }
    },
    [baseUrl, beginMutation, refresh],
  );

  const deleteAllWalls = useCallback(async (): Promise<void> => {
    if (!baseUrl) return;
    beginMutation();
    setWalls([]);
    try {
      await editorSaveTracker.track(async () => {
        const res = await fetch(baseUrl, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to delete walls'));
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete walls');
      void refresh();
    }
  }, [baseUrl, beginMutation, refresh]);

  return { walls, error, createWall, updateWall, deleteWall, deleteAllWalls, refresh };
}
