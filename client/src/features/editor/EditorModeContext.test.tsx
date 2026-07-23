// EditorModeContext — Phase 5A / 5B tests
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditorModeProvider, useEditorMode } from './EditorModeContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <EditorModeProvider>{children}</EditorModeProvider>;
}

describe('useEditorMode', () => {
  it('starts in play mode', () => {
    const { result } = renderHook(() => useEditorMode(), { wrapper });
    expect(result.current.mode).toBe('play');
  });

  it('toggleMode switches play → editor', () => {
    const { result } = renderHook(() => useEditorMode(), { wrapper });
    act(() => {
      result.current.toggleMode();
    });
    expect(result.current.mode).toBe('editor');
  });

  it('toggleMode switches editor → play', () => {
    const { result } = renderHook(() => useEditorMode(), { wrapper });
    act(() => {
      result.current.toggleMode();
    });
    act(() => {
      result.current.toggleMode();
    });
    expect(result.current.mode).toBe('play');
  });

  it('setMode sets mode directly', () => {
    const { result } = renderHook(() => useEditorMode(), { wrapper });
    act(() => {
      result.current.setMode('editor');
    });
    expect(result.current.mode).toBe('editor');
  });

  it('throws when used outside EditorModeProvider', () => {
    const consoleError = console.error;
    console.error = () => {};
    expect(() => renderHook(() => useEditorMode())).toThrow(
      'useEditorMode must be used within an EditorModeProvider',
    );
    console.error = consoleError;
  });

  describe('selectedTilePlacementId', () => {
    it('starts as null', () => {
      const { result } = renderHook(() => useEditorMode(), { wrapper });
      expect(result.current.selectedTilePlacementId).toBeNull();
    });

    it('setSelectedTilePlacementId updates the value', () => {
      const { result } = renderHook(() => useEditorMode(), { wrapper });
      act(() => {
        result.current.setSelectedTilePlacementId('placement-1');
      });
      expect(result.current.selectedTilePlacementId).toBe('placement-1');
    });

    it('toggleMode clears the selected placement', () => {
      const { result } = renderHook(() => useEditorMode(), { wrapper });
      act(() => {
        result.current.setSelectedTilePlacementId('placement-1');
      });
      act(() => {
        result.current.toggleMode();
      });
      expect(result.current.selectedTilePlacementId).toBeNull();
    });
  });
});
