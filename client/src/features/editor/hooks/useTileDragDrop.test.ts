// useTileDragDrop — Phase 5B tests
// Verifies grid-snap math, alt-bypass, and drop event handling.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CanvasManager } from '../../play-area/canvas/CanvasManager';
import { ASSET_DRAG_MIME, useTileDragDrop } from './useTileDragDrop';

/** Minimal mock of CanvasManager with a spy on handleAssetDrop */
function makeCanvasManagerMock() {
  return {
    handleAssetDrop: vi.fn(),
  } as unknown as CanvasManager;
}

function makeDragEvent(overrides?: {
  clientX?: number;
  clientY?: number;
  altKey?: boolean;
  assetData?: string;
  rect?: DOMRect;
}): DragEvent {
  const assetData =
    overrides?.assetData ??
    JSON.stringify({ id: 'asset-1', width: 256, height: 256, category: 'background' });
  const clientX = overrides?.clientX ?? 100;
  const clientY = overrides?.clientY ?? 200;
  const altKey = overrides?.altKey ?? false;
  const rect = overrides?.rect ?? ({ left: 0, top: 0 } as DOMRect);

  return {
    preventDefault: vi.fn(),
    dataTransfer: {
      dropEffect: '',
      getData: (mime: string) => (mime === ASSET_DRAG_MIME ? assetData : ''),
    },
    clientX,
    clientY,
    altKey,
    currentTarget: {
      getBoundingClientRect: () => rect,
    },
  } as unknown as DragEvent;
}

describe('useTileDragDrop', () => {
  describe('handleDragOver', () => {
    it('calls preventDefault in editor mode', () => {
      const cm = makeCanvasManagerMock();
      const { result } = renderHook(() =>
        useTileDragDrop({ canvasManager: cm, isEditorMode: true }),
      );
      const e = makeDragEvent();
      result.current.handleDragOver(e as unknown as React.DragEvent<HTMLElement>);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('does not call preventDefault in play mode', () => {
      const cm = makeCanvasManagerMock();
      const { result } = renderHook(() =>
        useTileDragDrop({ canvasManager: cm, isEditorMode: false }),
      );
      const e = makeDragEvent();
      result.current.handleDragOver(e as unknown as React.DragEvent<HTMLElement>);
      expect(e.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('handleDrop', () => {
    it('calls handleAssetDrop with snap when altKey is false', () => {
      const cm = makeCanvasManagerMock();
      const { result } = renderHook(() =>
        useTileDragDrop({ canvasManager: cm, isEditorMode: true }),
      );
      const e = makeDragEvent({ clientX: 150, clientY: 250, altKey: false });
      result.current.handleDrop(e as unknown as React.DragEvent<HTMLElement>);

      expect(cm.handleAssetDrop).toHaveBeenCalledWith(
        'asset-1',
        256,
        256,
        'background',
        150,
        250,
        expect.any(Object),
        false, // altHeld = false → snap to grid
      );
    });

    it('passes altKey=true to handleAssetDrop (bypasses grid snap)', () => {
      const cm = makeCanvasManagerMock();
      const { result } = renderHook(() =>
        useTileDragDrop({ canvasManager: cm, isEditorMode: true }),
      );
      const e = makeDragEvent({ altKey: true });
      result.current.handleDrop(e as unknown as React.DragEvent<HTMLElement>);

      expect(cm.handleAssetDrop).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        expect.any(Number),
        expect.any(Number),
        expect.any(Object),
        true, // altHeld = true → bypass grid snap
      );
    });

    it('does nothing when not in editor mode', () => {
      const cm = makeCanvasManagerMock();
      const { result } = renderHook(() =>
        useTileDragDrop({ canvasManager: cm, isEditorMode: false }),
      );
      const e = makeDragEvent();
      result.current.handleDrop(e as unknown as React.DragEvent<HTMLElement>);
      expect(cm.handleAssetDrop).not.toHaveBeenCalled();
    });

    it('does nothing when canvasManager is null', () => {
      const { result } = renderHook(() =>
        useTileDragDrop({ canvasManager: null, isEditorMode: true }),
      );
      const e = makeDragEvent();
      // Should not throw
      expect(() => {
        result.current.handleDrop(e as unknown as React.DragEvent<HTMLElement>);
      }).not.toThrow();
    });

    it('does nothing when drag data is not a valid asset', () => {
      const cm = makeCanvasManagerMock();
      const { result } = renderHook(() =>
        useTileDragDrop({ canvasManager: cm, isEditorMode: true }),
      );
      // Missing required fields
      const e = makeDragEvent({ assetData: JSON.stringify({ id: 'x' }) });
      result.current.handleDrop(e as unknown as React.DragEvent<HTMLElement>);
      expect(cm.handleAssetDrop).not.toHaveBeenCalled();
    });

    it('does nothing when drag data is malformed JSON', () => {
      const cm = makeCanvasManagerMock();
      const { result } = renderHook(() =>
        useTileDragDrop({ canvasManager: cm, isEditorMode: true }),
      );
      const e = makeDragEvent({ assetData: '{not json}' });
      result.current.handleDrop(e as unknown as React.DragEvent<HTMLElement>);
      expect(cm.handleAssetDrop).not.toHaveBeenCalled();
    });
  });
});
