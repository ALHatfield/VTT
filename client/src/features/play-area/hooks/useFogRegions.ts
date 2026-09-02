import { useCallback, useEffect, useState } from 'react';

import type { FogRegion } from '@vtt/shared';

interface UseFogRegionsReturn {
  regions: FogRegion[];
  isLoading: boolean;
  error: string | null;
  applyRemoteReveal: (region: FogRegion) => void;
  applyRemoteHide: (removedRegionIds: string[]) => void;
  applyRemoteDelete: (regionId: string) => void;
  refresh: () => void;
}

export function useFogRegions(
  campaignId: string | undefined,
  sceneId: string | undefined,
): UseFogRegionsReturn {
  const [regions, setRegions] = useState<FogRegion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const fetchRegions = useCallback(async (): Promise<void> => {
    if (!campaignId || !sceneId) {
      setRegions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ?? 'Failed to load fog',
        );
      }

      const body = (await res.json()) as { data: FogRegion[] };
      setRegions(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fog');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, sceneId]);

  useEffect(() => {
    fetchRegions().catch((err: unknown) => {
      console.error('[useFogRegions] Unexpected error:', err);
    });
  }, [fetchRegions, tick]);

  const applyRemoteReveal = useCallback((region: FogRegion): void => {
    setRegions((prev) => {
      if (prev.some((r) => r.id === region.id)) return prev;
      return [...prev, region];
    });
  }, []);

  const applyRemoteHide = useCallback((removedRegionIds: string[]): void => {
    if (removedRegionIds.length === 0) return;
    const ids = new Set(removedRegionIds);
    setRegions((prev) => prev.filter((region) => !ids.has(region.id)));
  }, []);

  const applyRemoteDelete = useCallback((regionId: string): void => {
    setRegions((prev) => prev.filter((r) => r.id !== regionId));
  }, []);

  const refresh = useCallback((): void => {
    setTick((n) => n + 1);
  }, []);

  return {
    regions,
    isLoading,
    error,
    applyRemoteReveal,
    applyRemoteHide,
    applyRemoteDelete,
    refresh,
  };
}
