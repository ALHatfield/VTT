import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import { CanvasManager } from '../canvas/CanvasManager';

export interface UseCanvasReturn {
  canvasManager: CanvasManager | null;
  isReady: boolean;
}

export function useCanvas(containerRef: RefObject<HTMLDivElement>): UseCanvasReturn {
  const [canvasManager, setCanvasManager] = useState<CanvasManager | null>(null);
  const managerRef = useRef<CanvasManager | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    const container = containerRef.current;
    const manager = new CanvasManager();
    managerRef.current = manager;

    // Keep a reference to the init promise so cleanup can wait for it before
    // calling destroy — calling destroy on a partially-initialized PixiJS
    // Application crashes because _cancelResize hasn't been set yet.
    const initPromise = manager.init(container);

    initPromise
      .then(() => {
        if (!cancelled) setCanvasManager(manager);
      })
      .catch((error: unknown) => {
        console.error('[useCanvas] Failed to initialize canvas:', error);
      });

    return (): void => {
      cancelled = true;
      managerRef.current = null;
      setCanvasManager(null);
      initPromise
        .then(() => manager.destroy())
        .catch(() => {
          // init failed — nothing to destroy
        });
    };
    // containerRef is a stable ref object — exhaustive-deps is intentionally suppressed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    canvasManager,
    isReady: canvasManager !== null,
  };
}
