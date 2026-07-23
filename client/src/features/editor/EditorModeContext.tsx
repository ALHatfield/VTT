// EditorModeContext — Phase 5A / 5B
// Provides editor/play mode state and tile selection at the play-area root
import type { ReactElement, ReactNode } from 'react';
import { createContext, useCallback, useContext, useState } from 'react';

import type { EditorMode } from '@vtt/shared';

interface EditorModeContextValue {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  toggleMode: () => void;
  /** ID of the currently selected tile placement, or null if none. */
  selectedTilePlacementId: string | null;
  setSelectedTilePlacementId: (id: string | null) => void;
}

const EditorModeContext = createContext<EditorModeContextValue | null>(null);

interface EditorModeProviderProps {
  children: ReactNode;
}

export function EditorModeProvider({ children }: EditorModeProviderProps): ReactElement {
  const [mode, setMode] = useState<EditorMode>('play');
  const [selectedTilePlacementId, setSelectedTilePlacementId] = useState<string | null>(null);

  const toggleMode = useCallback((): void => {
    setMode((prev) => (prev === 'play' ? 'editor' : 'play'));
    // Deselect any tile when switching modes
    setSelectedTilePlacementId(null);
  }, []);

  return (
    <EditorModeContext.Provider
      value={{ mode, setMode, toggleMode, selectedTilePlacementId, setSelectedTilePlacementId }}
    >
      {children}
    </EditorModeContext.Provider>
  );
}

export function useEditorMode(): EditorModeContextValue {
  const ctx = useContext(EditorModeContext);
  if (!ctx) {
    throw new Error('useEditorMode must be used within an EditorModeProvider');
  }
  return ctx;
}
