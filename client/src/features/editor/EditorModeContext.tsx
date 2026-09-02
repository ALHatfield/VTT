// EditorModeContext — Phase 5A / 5B
// Provides editor/play mode state and tile selection at the play-area root
import type { ReactElement, ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { EditorMode } from '@vtt/shared';

const EMPTY_SELECTION: ReadonlySet<string> = new Set<string>();

interface EditorModeContextValue {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  toggleMode: () => void;
  /**
   * Set of currently selected tile placement IDs. Empty when nothing is
   * selected. Selection is set-based to support Shift+click and marquee drag.
   */
  selectedTilePlacementIds: ReadonlySet<string>;
  setSelectedTilePlacementIds: (ids: ReadonlySet<string>) => void;
}

const EditorModeContext = createContext<EditorModeContextValue | null>(null);

interface EditorModeProviderProps {
  children: ReactNode;
}

export function EditorModeProvider({ children }: EditorModeProviderProps): ReactElement {
  const [mode, setMode] = useState<EditorMode>('play');
  const [selectedTilePlacementIds, setSelectedTilePlacementIdsState] =
    useState<ReadonlySet<string>>(EMPTY_SELECTION);

  const setSelectedTilePlacementIds = useCallback((ids: ReadonlySet<string>): void => {
    setSelectedTilePlacementIdsState(ids.size === 0 ? EMPTY_SELECTION : new Set(ids));
  }, []);

  const toggleMode = useCallback((): void => {
    setMode((prev) => (prev === 'play' ? 'editor' : 'play'));
    // Deselect any tiles when switching modes
    setSelectedTilePlacementIdsState(EMPTY_SELECTION);
  }, []);

  const value = useMemo(
    (): EditorModeContextValue => ({
      mode,
      setMode,
      toggleMode,
      selectedTilePlacementIds,
      setSelectedTilePlacementIds,
    }),
    [mode, toggleMode, selectedTilePlacementIds, setSelectedTilePlacementIds],
  );

  return <EditorModeContext.Provider value={value}>{children}</EditorModeContext.Provider>;
}

export function useEditorMode(): EditorModeContextValue {
  const ctx = useContext(EditorModeContext);
  if (!ctx) {
    throw new Error('useEditorMode must be used within an EditorModeProvider');
  }
  return ctx;
}
