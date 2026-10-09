// useTilePlacements — Phase 5B
// Fetches and manages tile placements for a scene. Debounced updates merge
// payloads per placement and flush to the originating scene when the scene
// changes or the hook unmounts (Phase 5H).
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AssetCategory, TilePlacement } from '@vtt/shared';
import { PLACEMENT_AUTOSAVE_DEBOUNCE_MS } from '@vtt/shared';

import { editorSaveTracker } from '../utils/save-tracker';

interface CreatePayload {
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  category: AssetCategory;
}

interface UpdatePayload {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
  category?: AssetCategory;
}

interface UseTilePlacementsReturn {
  placements: TilePlacement[];
  isLoading: boolean;
  error: string | null;
  createPlacement: (payload: CreatePayload) => Promise<TilePlacement | null>;
  updatePlacement: (placementId: string, payload: UpdatePayload) => void;
  deletePlacement: (placementId: string) => Promise<void>;
  refresh: () => void;
}

export function useTilePlacements(
  campaignId: string | undefined,
  sceneId: string | undefined,
): UseTilePlacementsReturn {
  const [placements, setPlacements] = useState<TilePlacement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced updates: placementId → merged payload + timer handle
  const pendingUpdates = useRef<
    Map<string, { payload: UpdatePayload; timer: ReturnType<typeof setTimeout> }>
  >(new Map());
  // Discards responses from superseded fetches (e.g. rapid scene switches)
  const fetchSeqRef = useRef(0);

  const baseUrl =
    campaignId && sceneId ? `/api/campaigns/${campaignId}/scenes/${sceneId}/placements` : null;

  const fetchPlacements = useCallback(async (): Promise<void> => {
    const seq = ++fetchSeqRef.current;
    if (!baseUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(baseUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data: TilePlacement[] };
      if (seq !== fetchSeqRef.current) return;
      setPlacements(body.data);
    } catch (err: unknown) {
      if (seq !== fetchSeqRef.current) return;
      const msg = err instanceof Error ? err.message : 'Failed to load placements';
      setError(msg);
    } finally {
      if (seq === fetchSeqRef.current) setIsLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    // Clear immediately so a slow old-scene response can't render on the new scene
    setPlacements([]);
    void fetchPlacements();
  }, [fetchPlacements]);

  const sendUpdate = useCallback(
    async (url: string, placementId: string, payload: UpdatePayload): Promise<void> => {
      try {
        await editorSaveTracker.track(async () => {
          const res = await fetch(`${url}/${placementId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const body = (await res.json()) as { error?: { message?: string } };
            throw new Error(body.error?.message ?? `Update failed: HTTP ${res.status}`);
          }
        }, `tile:${placementId}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update placement';
        setError(msg);
      }
    },
    [],
  );

  // Flush unsent edits to the scene they were made on when the scene changes or on unmount
  useEffect(() => {
    const pending = pendingUpdates.current;
    return () => {
      for (const [placementId, { payload, timer }] of pending) {
        clearTimeout(timer);
        editorSaveTracker.setPending(`tile:${placementId}`, false);
        if (baseUrl) void sendUpdate(baseUrl, placementId, payload);
      }
      pending.clear();
    };
  }, [baseUrl, sendUpdate]);

  const createPlacement = useCallback(
    async (payload: CreatePayload): Promise<TilePlacement | null> => {
      if (!baseUrl) return null;
      try {
        const body = await editorSaveTracker.track(async () => {
          const res = await fetch(baseUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const errBody = (await res.json()) as { error?: { message?: string } };
            throw new Error(errBody.error?.message ?? `Create failed: HTTP ${res.status}`);
          }
          return (await res.json()) as { data: TilePlacement };
        });
        const newPlacement = body.data;
        setPlacements((prev) => [...prev, newPlacement]);
        return newPlacement;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create placement';
        setError(msg);
        return null;
      }
    },
    [baseUrl],
  );

  /**
   * Debounced update — fires the API PLACEMENT_AUTOSAVE_DEBOUNCE_MS after the last call.
   * Applies optimistic updates to local state immediately and merges consecutive
   * payloads for the same placement.
   */
  const updatePlacement = useCallback(
    (placementId: string, payload: UpdatePayload): void => {
      if (!baseUrl) return;

      // Optimistic update
      setPlacements((prev) => prev.map((p) => (p.id === placementId ? { ...p, ...payload } : p)));

      const existing = pendingUpdates.current.get(placementId);
      if (existing) clearTimeout(existing.timer);
      const merged = { ...existing?.payload, ...payload };

      editorSaveTracker.setPending(`tile:${placementId}`, true);
      const timer = setTimeout(() => {
        pendingUpdates.current.delete(placementId);
        editorSaveTracker.setPending(`tile:${placementId}`, false);
        void sendUpdate(baseUrl, placementId, merged);
      }, PLACEMENT_AUTOSAVE_DEBOUNCE_MS);

      pendingUpdates.current.set(placementId, { payload: merged, timer });
    },
    [baseUrl, sendUpdate],
  );

  const deletePlacement = useCallback(
    async (placementId: string): Promise<void> => {
      if (!baseUrl) return;

      // Cancel any pending debounce for this placement before deleting
      const existing = pendingUpdates.current.get(placementId);
      if (existing) {
        clearTimeout(existing.timer);
        pendingUpdates.current.delete(placementId);
        editorSaveTracker.setPending(`tile:${placementId}`, false);
      }

      // Optimistic remove
      setPlacements((prev) => prev.filter((p) => p.id !== placementId));

      try {
        await editorSaveTracker.track(async () => {
          const res = await fetch(`${baseUrl}/${placementId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (!res.ok && res.status !== 404) {
            throw new Error(`Delete failed: HTTP ${res.status}`);
          }
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete placement';
        setError(msg);
        // Refresh to restore correct state after a failed delete
        void fetchPlacements();
      }
    },
    [baseUrl, fetchPlacements],
  );

  return {
    placements,
    isLoading,
    error,
    createPlacement,
    updatePlacement,
    deletePlacement,
    refresh: fetchPlacements,
  };
}
