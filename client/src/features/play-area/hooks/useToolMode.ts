import { useState } from 'react';

import type { ToolMode } from '../canvas/CanvasManager';

export type { ToolMode };

interface UseToolModeResult {
  activeTool: ToolMode;
  setActiveTool: (tool: ToolMode) => void;
}

export function useToolMode(initial: ToolMode = 'select'): UseToolModeResult {
  const [activeTool, setActiveTool] = useState<ToolMode>(initial);
  return { activeTool, setActiveTool };
}
