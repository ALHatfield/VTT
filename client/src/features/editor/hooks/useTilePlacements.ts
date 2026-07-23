// useTilePlacements — Phase 5B
// Fetches and manages tile placements for a scene
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AssetCategory, TilePlacement } from '@vtt/shared';
import { PLACEMENT_AUTOSAVE_DEBOUNCE_MS } from '@vtt/shared';

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

  // Debounce timers: placementId → timer handle
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const baseUrl =
    campaignId && sceneId ? `/api/campaigns/${campaignId}/scenes/${sceneId}/placements` : null;

  const fetchPlacements = useCallback(async (): Promise<void> => {
    if (!baseUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(baseUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data: TilePlacement[] };
      setPlacements(body.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load placements';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void fetchPlacements();
  }, [fetchPlacements]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const createPlacement = useCallback(
    async (payload: CreatePayload): Promise<TilePlacement | null> => {
      if (!baseUrl) return null;
      try {
        const res = await fetch(baseUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? `Create failed: HTTP ${res.status}`);
        }
        const body = (await res.json()) as { data: TilePlacement };
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
   * Applies optimistic updates to local state immediately.
   */
  const updatePlacement = useCallback(
    (placementId: string, payload: UpdatePayload): void => {
      if (!baseUrl) return;

      // Optimistic update
      setPlacements((prev) => prev.map((p) => (p.id === placementId ? { ...p, ...payload } : p)));

      // Clear any pending debounce for this placement
      const existing = debounceTimers.current.get(placementId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        debounceTimers.current.delete(placementId);
        try {
          const res = await fetch(`${baseUrl}/${placementId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const body = (await res.json()) as { error?: { message?: string } };
            throw new Error(body.error?.message ?? `Update failed: HTTP ${res.status}`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to update placement';
          setError(msg);
        }
      }, PLACEMENT_AUTOSAVE_DEBOUNCE_MS);

      debounceTimers.current.set(placementId, timer);
    },
    [baseUrl],
  );

  const deletePlacement = useCallback(
    async (placementId: string): Promise<void> => {
      if (!baseUrl) return;

      // Clear any pending debounce for this placement before deleting
      const existing = debounceTimers.current.get(placementId);
      if (existing) {
        clearTimeout(existing);
        debounceTimers.current.delete(placementId);
      }

      // Optimistic remove
      setPlacements((prev) => prev.filter((p) => p.id !== placementId));

      try {
        const res = await fetch(`${baseUrl}/${placementId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok && res.status !== 404) {
          throw new Error(`Delete failed: HTTP ${res.status}`);
        }
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
