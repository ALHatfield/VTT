import { useCallback, useEffect, useState } from 'react';

import type { DiceAnimationMode } from '@vtt/shared';
import { DICE_3D_STORAGE_KEY } from '@vtt/shared';

interface UseDiceSettingsReturn {
  /** The user's saved preference. */
  mode: DiceAnimationMode;
  setMode: (mode: DiceAnimationMode) => void;
  /** Preference resolved against reduced-motion and WebGL availability. */
  effectiveMode: DiceAnimationMode;
}

function readStoredMode(): DiceAnimationMode {
  try {
    const stored = localStorage.getItem(DICE_3D_STORAGE_KEY);
    return stored === 'instant' || stored === '3d' ? stored : '3d';
  } catch {
    return '3d';
  }
}

// Probe once per page — repeated probes leak WebGL contexts (browsers cap ~16)
let webglProbeResult: boolean | null = null;

function probeWebGL(): boolean {
  if (webglProbeResult !== null) return webglProbeResult;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    webglProbeResult = ctx !== null;
    if (ctx) {
      ctx.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webglProbeResult = false;
  }
  return webglProbeResult;
}

/**
 * Per-user dice animation preference (persisted to localStorage) with
 * accessibility and capability fallbacks: prefers-reduced-motion or missing
 * WebGL forces instant reveal regardless of preference.
 */
export function useDiceSettings(): UseDiceSettingsReturn {
  const [mode, setModeState] = useState<DiceAnimationMode>(readStoredMode);
  const [webglAvailable] = useState(probeWebGL);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent): void => {
      setReducedMotion(e.matches);
    };
    mq.addEventListener('change', onChange);
    return (): void => {
      mq.removeEventListener('change', onChange);
    };
  }, []);

  const setMode = useCallback((next: DiceAnimationMode): void => {
    setModeState(next);
    try {
      localStorage.setItem(DICE_3D_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private mode) — preference is session-only
    }
  }, []);

  const effectiveMode: DiceAnimationMode =
    mode === '3d' && webglAvailable && !reducedMotion ? '3d' : 'instant';

  return { mode, setMode, effectiveMode };
}
