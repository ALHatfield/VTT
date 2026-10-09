// useSceneAtmosphere — Phase 5G
// DM-only read/write of the scene's default weather preset (rendered by play-area PM5).
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SceneAtmosphere, WeatherPreset } from '@vtt/shared';

import { editorSaveTracker } from '../utils/save-tracker';

interface UseSceneAtmosphereReturn {
  /** Null until loaded (or when disabled). */
  weatherPreset: WeatherPreset | null;
  error: string | null;
  setWeatherPreset: (preset: WeatherPreset) => Promise<void>;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return body.error?.message ?? `${fallback}: HTTP ${res.status}`;
}

export function useSceneAtmosphere(
  campaignId: string | undefined,
  sceneId: string | undefined,
  enabled: boolean,
): UseSceneAtmosphereReturn {
  const [weatherPreset, setPreset] = useState<WeatherPreset | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by every load and save so only the latest request for the current scene lands
  const seqRef = useRef(0);

  const url =
    enabled && campaignId && sceneId
      ? `/api/campaigns/${campaignId}/scenes/${sceneId}/atmosphere`
      : null;
  const urlRef = useRef(url);
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const load = useCallback(async (): Promise<void> => {
    const seq = ++seqRef.current;
    if (!url) return;
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to load atmosphere'));
      const { data } = (await res.json()) as { data: SceneAtmosphere };
      if (seq === seqRef.current) setPreset(data.weatherPreset);
    } catch (err: unknown) {
      if (seq === seqRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load atmosphere');
      }
    }
  }, [url]);

  useEffect(() => {
    setPreset(null);
    setError(null);
    void load();
  }, [load]);

  const setWeatherPreset = useCallback(
    async (preset: WeatherPreset): Promise<void> => {
      if (!url) return;
      const seq = ++seqRef.current;
      setPreset(preset);
      setError(null);
      try {
        await editorSaveTracker.track(async () => {
          const res = await fetch(url, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weatherPreset: preset } satisfies SceneAtmosphere),
          });
          if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to save atmosphere'));
        });
      } catch (err: unknown) {
        if (seq !== seqRef.current || urlRef.current !== url) return;
        setError(err instanceof Error ? err.message : 'Failed to save atmosphere');
        // Re-sync from the server rather than guessing the prior value
        void load();
      }
    },
    [url, load],
  );

  return { weatherPreset, error, setWeatherPreset };
}
