import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DRAW_THROTTLE_MS } from '@vtt/shared';

import type { CanvasManager } from '../canvas/CanvasManager';
import type { PlaygroundLayer } from '../canvas/PlaygroundLayer';
import { useDrawTool } from './useDrawTool';

const makeMockPlaygroundLayer = (): PlaygroundLayer =>
  ({
    addOrUpdateDrawStroke: vi.fn(),
    clearDrawings: vi.fn(),
  }) as unknown as PlaygroundLayer;

const makeMockCanvasManager = (layer: PlaygroundLayer): CanvasManager =>
  ({ playgroundLayer: layer }) as unknown as CanvasManager;

describe('useDrawTool', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('crypto', { randomUUID: () => 'test-stroke-id' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders freehand stroke locally on pointer move', () => {
    const layer = makeMockPlaygroundLayer();
    const canvasManager = makeMockCanvasManager(layer);
    const emitDrawStroke = vi.fn();
    const emitDrawClear = vi.fn();

    const { result } = renderHook(() =>
      useDrawTool({
        canvasManager,
        userId: 'user-1',
        campaignId: 'campaign-1',
        isActive: true,
        shapeType: 'freehand',
        strokeColor: '#ff0000',
        strokeWidth: 3,
        emitDrawStroke,
        emitDrawClear,
      }),
    );

    act(() => {
      result.current.handlePointerDown(10, 20);
      result.current.handlePointerMove(15, 25);
    });

    // pointerDown seeds the start point; pointerMove passes only the delta point
    expect(layer.addOrUpdateDrawStroke).toHaveBeenCalledTimes(2);
    expect(layer.addOrUpdateDrawStroke).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'test-stroke-id',
      [{ x: 10, y: 20 }],
      '#ff0000',
      3,
      'freehand',
    );
    expect(layer.addOrUpdateDrawStroke).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'test-stroke-id',
      [{ x: 15, y: 25 }],
      '#ff0000',
      3,
      'freehand',
    );
  });

  it('replaces shape points on move (rect)', () => {
    const layer = makeMockPlaygroundLayer();
    const canvasManager = makeMockCanvasManager(layer);
    const emitDrawStroke = vi.fn();
    const emitDrawClear = vi.fn();

    const { result } = renderHook(() =>
      useDrawTool({
        canvasManager,
        userId: 'user-1',
        campaignId: 'campaign-1',
        isActive: true,
        shapeType: 'rect',
        strokeColor: '#0000ff',
        strokeWidth: 2,
        emitDrawStroke,
        emitDrawClear,
      }),
    );

    act(() => {
      result.current.handlePointerDown(0, 0);
      result.current.handlePointerMove(50, 50);
      result.current.handlePointerMove(100, 100);
    });

    // Last call should have start + latest end point only (not accumulated)
    const calls = vi.mocked(layer.addOrUpdateDrawStroke).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[2]).toHaveLength(2);
    expect(lastCall[2][0]).toEqual({ x: 0, y: 0 });
    expect(lastCall[2][1]).toEqual({ x: 100, y: 100 });
  });

  it('throttles socket emission to ~30fps', () => {
    const layer = makeMockPlaygroundLayer();
    const canvasManager = makeMockCanvasManager(layer);
    const emitDrawStroke = vi.fn();
    const emitDrawClear = vi.fn();

    const { result } = renderHook(() =>
      useDrawTool({
        canvasManager,
        userId: 'user-1',
        campaignId: 'campaign-1',
        isActive: true,
        shapeType: 'freehand',
        strokeColor: '#ff0000',
        strokeWidth: 3,
        emitDrawStroke,
        emitDrawClear,
      }),
    );

    act(() => {
      result.current.handlePointerDown(0, 0);
      // Fire many move events rapidly (within throttle window)
      for (let i = 1; i <= 10; i++) {
        result.current.handlePointerMove(i * 5, i * 5);
      }
    });

    // Only the initial move (which resets lastEmitTime) should have been emitted
    const nonFinalEmits = emitDrawStroke.mock.calls.filter(
      (c: unknown[]) => !(c[0] as { isFinal: boolean }).isFinal,
    );
    // Should emit at most 1 time during the rapid burst (first move after pointerDown)
    expect(nonFinalEmits.length).toBeLessThanOrEqual(1);
  });

  it('emits final payload on pointer up', () => {
    const layer = makeMockPlaygroundLayer();
    const canvasManager = makeMockCanvasManager(layer);
    const emitDrawStroke = vi.fn();
    const emitDrawClear = vi.fn();

    const { result } = renderHook(() =>
      useDrawTool({
        canvasManager,
        userId: 'user-1',
        campaignId: 'campaign-1',
        isActive: true,
        shapeType: 'freehand',
        strokeColor: '#ff0000',
        strokeWidth: 3,
        emitDrawStroke,
        emitDrawClear,
      }),
    );

    act(() => {
      result.current.handlePointerDown(0, 0);
      vi.advanceTimersByTime(DRAW_THROTTLE_MS + 10);
      result.current.handlePointerMove(10, 10);
      vi.advanceTimersByTime(DRAW_THROTTLE_MS + 10);
      result.current.handlePointerMove(20, 20);
      result.current.handlePointerUp();
    });

    const finalCall = emitDrawStroke.mock.calls.find(
      (c: unknown[]) => (c[0] as { isFinal: boolean }).isFinal,
    );
    expect(finalCall).toBeDefined();
    expect((finalCall?.[0] as { strokeId: string }).strokeId).toBe('test-stroke-id');
    expect((finalCall?.[0] as { isFinal: boolean }).isFinal).toBe(true);
  });

  it('clears in-progress stroke when deactivated mid-stroke', () => {
    const layer = makeMockPlaygroundLayer();
    const canvasManager = makeMockCanvasManager(layer);
    const emitDrawStroke = vi.fn();
    const emitDrawClear = vi.fn();

    const { result, rerender } = renderHook(
      ({ isActive }: { isActive: boolean }) =>
        useDrawTool({
          canvasManager,
          userId: 'user-1',
          campaignId: 'campaign-1',
          isActive,
          shapeType: 'freehand',
          strokeColor: '#ff0000',
          strokeWidth: 3,
          emitDrawStroke,
          emitDrawClear,
        }),
      { initialProps: { isActive: true } },
    );

    act(() => {
      result.current.handlePointerDown(0, 0);
      result.current.handlePointerMove(10, 10);
    });

    rerender({ isActive: false });

    expect(layer.clearDrawings).toHaveBeenCalledWith('own', 'user-1');
    expect(emitDrawClear).toHaveBeenCalledWith({ campaignId: 'campaign-1', scope: 'own' });
  });

  it('does nothing when not active', () => {
    const layer = makeMockPlaygroundLayer();
    const canvasManager = makeMockCanvasManager(layer);
    const emitDrawStroke = vi.fn();
    const emitDrawClear = vi.fn();

    const { result } = renderHook(() =>
      useDrawTool({
        canvasManager,
        userId: 'user-1',
        campaignId: 'campaign-1',
        isActive: false,
        shapeType: 'freehand',
        strokeColor: '#ff0000',
        strokeWidth: 3,
        emitDrawStroke,
        emitDrawClear,
      }),
    );

    act(() => {
      result.current.handlePointerDown(0, 0);
      result.current.handlePointerMove(10, 10);
      result.current.handlePointerUp();
    });

    expect(layer.addOrUpdateDrawStroke).not.toHaveBeenCalled();
    expect(emitDrawStroke).not.toHaveBeenCalled();
  });
});
