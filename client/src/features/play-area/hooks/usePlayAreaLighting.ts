// usePlayAreaLighting — Phase PM4
// Loads authored + temporary lights for the active scene and pushes them to the canvas.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LightSource, SceneLighting, TemporaryLight, TemporaryLightsUpdatedPayload } from '@vtt/shared';

import type { CanvasManager } from '../canvas/CanvasManager';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

interface UsePlayAreaLightingOptions {
  campaignId: string | undefined;
  sceneId: string | undefined;
  canvasManager: CanvasManager | null;
  isReady: boolean;
  /** Lights the viewer may see glowing (PM3); null/omitted renders every light. */
  visibleLightIds?: ReadonlySet<string> | null;
}

interface UsePlayAreaLightingReturn {
  authoredLights: LightSource[];
  temporaryLights: TemporaryLight[];
  refresh: () => Promise<void>;
  handleTemporaryLightsUpdated: (payload: TemporaryLightsUpdatedPayload) => void;
}

export function usePlayAreaLighting({
  campaignId,
  sceneId,
  canvasManager,
  isReady,
  visibleLightIds = null,
}: UsePlayAreaLightingOptions): UsePlayAreaLightingReturn {
  const [authoredLights, setAuthoredLights] = useState<LightSource[]>([]);
  const [temporaryLights, setTemporaryLights] = useState<TemporaryLight[]>([]);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
  // Drops responses from superseded fetches (e.g. after a scene switch)
  const fetchSeqRef = useRef(0);
  // Bumped per socket snapshot so an in-flight REST response can't overwrite a newer one
  const socketSnapshotSeqRef = useRef(0);

  const refresh = useCallback(async (): Promise<void> => {
    const seq = ++fetchSeqRef.current;
    const socketMark = socketSnapshotSeqRef.current;
    if (!campaignId || !sceneId) {
      setAuthoredLights([]);
      setTemporaryLights([]);
      return;
    }
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/scenes/${sceneId}/lighting`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load lighting: HTTP ${res.status}`);
      const { data } = (await res.json()) as { data: SceneLighting };
      if (seq !== fetchSeqRef.current) return;
      setAuthoredLights(data.authored);
      if (socketMark === socketSnapshotSeqRef.current) setTemporaryLights(data.temporary);
    } catch (err: unknown) {
      console.error('[usePlayAreaLighting]', err);
    }
  }, [campaignId, sceneId]);

  useEffect(() => {
    // Clear the previous scene's lights immediately rather than after the fetch
    setAuthoredLights([]);
    setTemporaryLights([]);
    void refresh();
  }, [refresh]);

  const handleTemporaryLightsUpdated = useCallback(
    (payload: TemporaryLightsUpdatedPayload): void => {
      if (payload.campaignId !== campaignId || payload.sceneId !== sceneId) return;
      socketSnapshotSeqRef.current++;
      setTemporaryLights(payload.lights);
    },
    [campaignId, sceneId],
  );

  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (e: MediaQueryListEvent): void => {
      setReducedMotion(e.matches);
    };
    mq.addEventListener('change', onChange);
    return (): void => {
      mq.removeEventListener('change', onChange);
    };
  }, []);

  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager.setLightingReducedMotion(reducedMotion);
  }, [canvasManager, isReady, reducedMotion]);

  useEffect(() => {
    if (!canvasManager || !isReady) return;
    const lights = [...authoredLights, ...temporaryLights];
    canvasManager.setLights(
      visibleLightIds ? lights.filter((light) => visibleLightIds.has(light.id)) : lights,
    );
  }, [canvasManager, isReady, authoredLights, temporaryLights, visibleLightIds]);

  return { authoredLights, temporaryLights, refresh, handleTemporaryLightsUpdated };
}
