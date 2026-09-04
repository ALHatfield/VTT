import { useCallback, useEffect, useRef, useState } from 'react';

import type { FogMaskConfig } from '@vtt/shared';
import { DEFAULT_FOG_MASK_CONFIG } from '@vtt/shared';

interface UseFogConfigReturn {
  config: FogMaskConfig;
  isLoading: boolean;
  error: string | null;
  applyRemoteConfig: (config: FogMaskConfig) => void;
  updateConfig: (patch: Partial<FogMaskConfig>) => Promise<void>;
  refresh: () => void;
}

/**
 * Scene-level PM2 fog mask configuration (Phase PM2).
 * DM updates are persisted through REST; every client also receives the
 * resulting config through `play-area:fog:config:updated`.
 */
export function useFogConfig(
  campaignId: string | undefined,
  sceneId: string | undefined,
): UseFogConfigReturn {
  const [config, setConfig] = useState<FogMaskConfig>({ ...DEFAULT_FOG_MASK_CONFIG });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // Monotonic request id — guards against out-of-order responses when the DM
  // drags a settings slider or switches scenes rapidly.
  const requestSeqRef = useRef(0);

  const fetchConfig = useCallback(async (): Promise<void> => {
    if (!campaignId || !sceneId) {
      setConfig({ ...DEFAULT_FOG_MASK_CONFIG });
      return;
    }

    setIsLoading(true);
    setError(null);
    const seq = ++requestSeqRef.current;

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/config`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ??
            'Failed to load fog settings',
        );
      }

      const body = (await res.json()) as { data: FogMaskConfig };
      if (seq === requestSeqRef.current) setConfig(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fog settings');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, sceneId]);

  useEffect(() => {
    fetchConfig().catch((err: unknown) => {
      console.error('[useFogConfig] Unexpected error:', err);
    });
  }, [fetchConfig, tick]);

  const applyRemoteConfig = useCallback((next: FogMaskConfig): void => {
    setConfig(next);
  }, []);

  const updateConfig = useCallback(
    async (patch: Partial<FogMaskConfig>): Promise<void> => {
      if (!campaignId || !sceneId) return;

      setError(null);
      const seq = ++requestSeqRef.current;

      try {
        const res = await fetch(`/api/campaigns/${campaignId}/scenes/${sceneId}/fog/config`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: { message?: string } }).error?.message ??
              'Failed to update fog settings',
          );
        }

        const body = (await res.json()) as { data: FogMaskConfig };
        if (seq === requestSeqRef.current) setConfig(body.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update fog settings');
      }
    },
    [campaignId, sceneId],
  );

  const refresh = useCallback((): void => {
    setTick((n) => n + 1);
  }, []);

  return { config, isLoading, error, applyRemoteConfig, updateConfig, refresh };
}
