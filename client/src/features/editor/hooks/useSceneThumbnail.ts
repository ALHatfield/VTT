// useSceneThumbnail — Phase 5H
// Captures the edited scene from PixiJS (background + foreground tile layers)
// debounced after edits, and immediately on demand before switching scenes.
// Uploads are best-effort — failures are logged, never surfaced as save errors.
import { useCallback, useEffect, useRef } from 'react';

import { SCENE_THUMBNAIL_CAPTURE_DEBOUNCE_MS, SCENE_THUMBNAIL_WIDTH } from '@vtt/shared';

interface SnapshotSource {
  extractSceneSnapshot: (maxWidth: number) => Promise<Blob | null>;
}

export interface UseSceneThumbnailOptions {
  canvasManager: SnapshotSource | null;
  /** The scene currently rendered on the canvas (the edited scene). */
  sceneId: string | undefined;
  /** DM in editor mode. */
  enabled: boolean;
  /** Changes identity whenever authored content changes — schedules a capture. */
  contentVersion: unknown;
  uploadThumbnail: (sceneId: string, blob: Blob) => Promise<void>;
}

export interface UseSceneThumbnailReturn {
  /** Capture and upload immediately (call before switching the edited scene). */
  captureNow: () => Promise<void>;
}

export function useSceneThumbnail({
  canvasManager,
  sceneId,
  enabled,
  contentVersion,
  uploadThumbnail,
}: UseSceneThumbnailOptions): UseSceneThumbnailReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest inputs for timer callbacks without re-scheduling on every change
  const stateRef = useRef({ canvasManager, sceneId, enabled, uploadThumbnail });
  stateRef.current = { canvasManager, sceneId, enabled, uploadThumbnail };
  // Only an actual contentVersion change schedules a capture — not mount or scene load
  const lastVersionRef = useRef(contentVersion);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const capture = useCallback(async (): Promise<void> => {
    const { canvasManager: cm, sceneId: id, enabled: on, uploadThumbnail: upload } =
      stateRef.current;
    if (!cm || !id || !on) return;
    try {
      const blob = await cm.extractSceneSnapshot(SCENE_THUMBNAIL_WIDTH);
      if (!blob) return;
      await upload(id, blob);
    } catch (err: unknown) {
      console.error('[useSceneThumbnail] Thumbnail capture failed:', err);
    }
  }, []);

  const captureNow = useCallback(async (): Promise<void> => {
    clearTimer();
    await capture();
  }, [clearTimer, capture]);

  // Debounced capture after authored content changes
  useEffect(() => {
    if (lastVersionRef.current === contentVersion) return;
    lastVersionRef.current = contentVersion;
    if (!enabled || !sceneId || !canvasManager) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void capture();
    }, SCENE_THUMBNAIL_CAPTURE_DEBOUNCE_MS);
    return clearTimer;
  }, [contentVersion, enabled, sceneId, canvasManager, capture, clearTimer]);

  return { captureNow };
}
