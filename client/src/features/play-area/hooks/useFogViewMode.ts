import { useState } from 'react';

export type FogViewMode = 'dm' | 'player';

interface UseFogViewModeResult {
  fogViewMode: FogViewMode;
  setFogViewMode: (mode: FogViewMode) => void;
}

export function useFogViewMode(): UseFogViewModeResult {
  const [fogViewMode, setFogViewMode] = useState<FogViewMode>('player');
  return { fogViewMode, setFogViewMode };
}
