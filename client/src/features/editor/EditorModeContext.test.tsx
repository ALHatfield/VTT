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

  describe('selectedTilePlacementIds', () => {
    it('starts as an empty set', () => {
      const { result } = renderHook(() => useEditorMode(), { wrapper });
      expect(result.current.selectedTilePlacementIds.size).toBe(0);
    });

    it('setSelectedTilePlacementIds updates the value', () => {
      const { result } = renderHook(() => useEditorMode(), { wrapper });
      act(() => {
        result.current.setSelectedTilePlacementIds(new Set(['placement-1']));
      });
      expect([...result.current.selectedTilePlacementIds]).toEqual(['placement-1']);
    });

    it('setSelectedTilePlacementIds supports multiple ids', () => {
      const { result } = renderHook(() => useEditorMode(), { wrapper });
      act(() => {
        result.current.setSelectedTilePlacementIds(new Set(['a', 'b', 'c']));
      });
      expect(result.current.selectedTilePlacementIds.size).toBe(3);
      expect(result.current.selectedTilePlacementIds.has('a')).toBe(true);
      expect(result.current.selectedTilePlacementIds.has('b')).toBe(true);
      expect(result.current.selectedTilePlacementIds.has('c')).toBe(true);
    });

    it('setSelectedTilePlacementIds with an empty set clears the selection', () => {
      const { result } = renderHook(() => useEditorMode(), { wrapper });
      act(() => {
        result.current.setSelectedTilePlacementIds(new Set(['a', 'b']));
      });
      act(() => {
        result.current.setSelectedTilePlacementIds(new Set());
      });
      expect(result.current.selectedTilePlacementIds.size).toBe(0);
    });

    it('toggleMode clears the selected placements', () => {
      const { result } = renderHook(() => useEditorMode(), { wrapper });
      act(() => {
        result.current.setSelectedTilePlacementIds(new Set(['placement-1', 'placement-2']));
      });
      act(() => {
        result.current.toggleMode();
      });
      expect(result.current.selectedTilePlacementIds.size).toBe(0);
    });
  });
});
