import { useCallback, useEffect, useState } from 'react';

import type { Scene } from '@vtt/shared';

interface UseActiveSceneReturn {
  scene: Scene | null;
  isLoading: boolean;
  error: string | null;
}

export function useActiveScene(campaignId: string | undefined): UseActiveSceneReturn {
  const [scene, setScene] = useState<Scene | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScene = useCallback(async (): Promise<void> => {
    if (!campaignId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/scenes/active`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: { message?: string } }).error?.message ?? 'Failed to load scene');
      }

      const data = (await res.json()) as { data: Scene };
      setScene(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scene');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchScene().catch((err: unknown) => {
      console.error('[useActiveScene] Unexpected error:', err);
    });
  }, [fetchScene]);

  return { scene, isLoading, error };
}
