import { renderHook } from '@testing-library/react';
import type { DragEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { CanvasManager } from '../canvas/CanvasManager';
import { NPC_DRAG_MIME, useNpcDrop } from './useNpcDrop';

function makeCanvasManager(worldX = 128, worldY = 192): Pick<CanvasManager, 'screenToWorld'> {
  return {
    screenToWorld: vi.fn().mockReturnValue({ x: worldX, y: worldY }),
  };
}

function makeDragEvent(
  overrides: Partial<{
    subtypeData: string;
    types: string[];
    clientX: number;
    clientY: number;
    currentTargetRect: DOMRect;
  }>,
): DragEvent<HTMLElement> {
  const {
    subtypeData = '',
    types = [NPC_DRAG_MIME],
    clientX = 200,
    clientY = 300,
    currentTargetRect = { left: 0, top: 0, right: 800, bottom: 600 } as DOMRect,
  } = overrides;

  return {
    dataTransfer: {
      types,
      dropEffect: '',
      getData: vi.fn().mockReturnValue(subtypeData),
    },
    preventDefault: vi.fn(),
    clientX,
    clientY,
    currentTarget: { getBoundingClientRect: () => currentTargetRect } as unknown as HTMLElement,
  } as unknown as DragEvent<HTMLElement>;
}

describe('useNpcDrop', () => {
  describe('handleDragOver', () => {
    it('prevents default when active and NPC MIME type is present', () => {
      const { result } = renderHook(() =>
        useNpcDrop({
          canvasManager: makeCanvasManager() as unknown as CanvasManager,
          createToken: vi.fn().mockResolvedValue({}),
          cellSize: 64,
          isActive: true,
        }),
      );

      const e = makeDragEvent({});
      result.current.handleDragOver(e);

      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('does not prevent default when not active', () => {
      const { result } = renderHook(() =>
        useNpcDrop({
          canvasManager: makeCanvasManager() as unknown as CanvasManager,
          createToken: vi.fn().mockResolvedValue({}),
          cellSize: 64,
          isActive: false,
        }),
      );

      const e = makeDragEvent({});
      result.current.handleDragOver(e);

      expect(e.preventDefault).not.toHaveBeenCalled();
    });

    it('does not prevent default when NPC MIME type is absent', () => {
      const { result } = renderHook(() =>
        useNpcDrop({
          canvasManager: makeCanvasManager() as unknown as CanvasManager,
          createToken: vi.fn().mockResolvedValue({}),
          cellSize: 64,
          isActive: true,
        }),
      );

      const e = makeDragEvent({ types: ['text/plain'] });
      result.current.handleDragOver(e);

      expect(e.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('handleDrop', () => {
    it('creates ally token at correct grid coordinates', async () => {
      // screenToWorld returns (128, 192), cellSize=64
      // Math.round(128/64)=2, Math.round(192/64)=3 → gridX=2, gridY=3
      const canvasManager = makeCanvasManager(128, 192) as unknown as CanvasManager;
      const createToken = vi.fn().mockResolvedValue({ id: 'tok1' });

      const { result } = renderHook(() =>
        useNpcDrop({ canvasManager, createToken, cellSize: 64, isActive: true }),
      );

      const e = makeDragEvent({ subtypeData: 'ally' });
      result.current.handleDrop(e);

      await vi.waitFor(() => expect(createToken).toHaveBeenCalled());
      expect(createToken).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'npc',
          npcSubtype: 'ally',
          x: 2,
          y: 3,
          name: 'Ally',
          size: 1,
        }),
      );
    });

    it('creates enemy token with correct subtype', async () => {
      const canvasManager = makeCanvasManager(0, 0) as unknown as CanvasManager;
      const createToken = vi.fn().mockResolvedValue({ id: 'tok2' });

      const { result } = renderHook(() =>
        useNpcDrop({ canvasManager, createToken, cellSize: 64, isActive: true }),
      );

      const e = makeDragEvent({ subtypeData: 'enemy' });
      result.current.handleDrop(e);

      await vi.waitFor(() => expect(createToken).toHaveBeenCalled());
      expect(createToken).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'npc', npcSubtype: 'enemy' }),
      );
    });

    it('ignores drop when not active', () => {
      const canvasManager = makeCanvasManager() as unknown as CanvasManager;
      const createToken = vi.fn().mockResolvedValue({});

      const { result } = renderHook(() =>
        useNpcDrop({ canvasManager, createToken, cellSize: 64, isActive: false }),
      );

      const e = makeDragEvent({ subtypeData: 'ally' });
      result.current.handleDrop(e);

      expect(createToken).not.toHaveBeenCalled();
    });

    it('ignores drop with invalid subtype', () => {
      const canvasManager = makeCanvasManager() as unknown as CanvasManager;
      const createToken = vi.fn().mockResolvedValue({});

      const { result } = renderHook(() =>
        useNpcDrop({ canvasManager, createToken, cellSize: 64, isActive: true }),
      );

      const e = makeDragEvent({ subtypeData: 'villain' });
      result.current.handleDrop(e);

      expect(createToken).not.toHaveBeenCalled();
    });

    it('ignores drop when canvasManager is null', () => {
      const createToken = vi.fn().mockResolvedValue({});

      const { result } = renderHook(() =>
        useNpcDrop({ canvasManager: null, createToken, cellSize: 64, isActive: true }),
      );

      const e = makeDragEvent({ subtypeData: 'ally' });
      result.current.handleDrop(e);

      expect(createToken).not.toHaveBeenCalled();
    });

    it('logs error when createToken rejects without rethrowing', async () => {
      const canvasManager = makeCanvasManager() as unknown as CanvasManager;
      const createToken = vi.fn().mockRejectedValue(new Error('Server error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const { result } = renderHook(() =>
        useNpcDrop({ canvasManager, createToken, cellSize: 64, isActive: true }),
      );

      const e = makeDragEvent({ subtypeData: 'ally' });
      result.current.handleDrop(e);

      await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalled());
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useNpcDrop]'),
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('clamps negative world coordinates to grid cell 0', async () => {
      // Math.max(0, Math.round(-10/64)) = Math.max(0, 0) = 0
      const canvasManager = makeCanvasManager(-10, -20) as unknown as CanvasManager;
      const createToken = vi.fn().mockResolvedValue({ id: 'tok3' });

      const { result } = renderHook(() =>
        useNpcDrop({ canvasManager, createToken, cellSize: 64, isActive: true }),
      );

      const e = makeDragEvent({ subtypeData: 'ally' });
      result.current.handleDrop(e);

      await vi.waitFor(() => expect(createToken).toHaveBeenCalled());
      expect(createToken).toHaveBeenCalledWith(expect.objectContaining({ x: 0, y: 0 }));
    });
  });
});
