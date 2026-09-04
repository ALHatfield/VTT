import { useCallback, useEffect, useState } from 'react';

import type { FogExplorationStamp, FogExplorationSyncPayload, VisionStamp } from '@vtt/shared';

interface UseFogExplorationReturn {
  stamps: VisionStamp[];
  isLoading: boolean;
  error: string | null;
  applyRemoteSync: (payload: FogExplorationSyncPayload) => void;
  resetExploration: () => Promise<void>;
  refresh: () => void;
}

/**
 * Persisted explored areas for a scene (Phase PM2).
 * Rehydrated over REST on join/reconnect so fog parity survives a reload, and
 * kept current through `play-area:fog:exploration:sync`.
 */
export function useFogExploration(
  campaignId: string | undefined,
  sceneId: string | undefined,
): UseFogExplorationReturn {
  const [stamps, setStamps] = useState<VisionStamp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const fetchStamps = useCallback(async (): Promise<void> => {
    if (!campaignId || !sceneId) {
      setStamps([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/exploration`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ??
            'Failed to load fog exploration',
        );
      }

      const body = (await res.json()) as { data: FogExplorationStamp[] };
      setStamps(body.data.map(toVisionStamp));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fog exploration');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, sceneId]);

  useEffect(() => {
    fetchStamps().catch((err: unknown) => {
      console.error('[useFogExploration] Unexpected error:', err);
    });
  }, [fetchStamps, tick]);

  const applyRemoteSync = useCallback((payload: FogExplorationSyncPayload): void => {
    const incoming = payload.stamps.map(toVisionStamp);

    if (payload.mode === 'replace') {
      setStamps(incoming);
      return;
    }

    setStamps((prev) => {
      const known = new Set(prev.map((s) => s.id));
      const added = incoming.filter((s) => !known.has(s.id));
      return added.length === 0 ? prev : [...prev, ...added];
    });
  }, []);

  const resetExploration = useCallback(async (): Promise<void> => {
    if (!campaignId || !sceneId) return;

    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/exploration`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to reset fog exploration');
      }

      setStamps([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset fog exploration');
    }
  }, [campaignId, sceneId]);

  const refresh = useCallback((): void => {
    setTick((n) => n + 1);
  }, []);

  return { stamps, isLoading, error, applyRemoteSync, resetExploration, refresh };
}

function toVisionStamp(stamp: FogExplorationStamp): VisionStamp {
  return { id: stamp.id, x: stamp.x, y: stamp.y, radius: stamp.radius };
}
