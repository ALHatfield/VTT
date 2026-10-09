import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DoorState, VisibilityPolygon, VisionUpdatedPayload } from '@vtt/shared';

import type { CanvasManager } from '../canvas/CanvasManager';
import { useLineOfSight } from './useLineOfSight';

type MockCanvas = CanvasManager & {
  setVisibilityPolygons: ReturnType<typeof vi.fn>;
  setDoors: ReturnType<typeof vi.fn>;
  setSelectedDoor: ReturnType<typeof vi.fn>;
};

function mockCanvas(): MockCanvas {
  return {
    setVisibilityPolygons: vi.fn(),
    setDoors: vi.fn(),
    setSelectedDoor: vi.fn(),
  } as unknown as MockCanvas;
}

const polygon: VisibilityPolygon = {
  emitterId: 'tok-1',
  source: 'token',
  partyVisible: true,
  sceneId: 's1',
  origin: { x: 0, y: 0 },
  radius: 100,
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 },
  ],
};
const doorA: DoorState = { id: 'door-a', x1: 0, y1: 0, x2: 10, y2: 0, isOpen: false };

function payload(overrides?: Partial<VisionUpdatedPayload>): VisionUpdatedPayload {
  return {
    campaignId: 'c1',
    sceneId: 's1',
    polygons: [polygon],
    doors: [doorA],
    visibleEnemyTokenIds: ['goblin'],
    ...overrides,
  };
}

describe('useLineOfSight', () => {
  function setup(
    canToggleDoors = true,
    view: { partyViewOnly?: boolean; canSeeAllLights?: boolean; hideUnseenEnemies?: boolean } = {},
  ): {
    canvas: MockCanvas;
    result: { current: ReturnType<typeof useLineOfSight> };
    rerender: (props: { sceneId: string }) => void;
  } {
    const canvas = mockCanvas();
    const { result, rerender } = renderHook(
      ({ sceneId }: { sceneId: string }) =>
        useLineOfSight({
          campaignId: 'c1',
          sceneId,
          canvasManager: canvas,
          isReady: true,
          canToggleDoors,
          partyViewOnly: view.partyViewOnly ?? false,
          canSeeAllLights: view.canSeeAllLights ?? false,
          hideUnseenEnemies: view.hideUnseenEnemies ?? true,
        }),
      { initialProps: { sceneId: 's1' } },
    );
    return { canvas, result, rerender };
  }

  const seenTorch: VisibilityPolygon = { ...polygon, emitterId: 'torch', source: 'light' };
  const hiddenFire: VisibilityPolygon = {
    ...polygon,
    emitterId: 'fire',
    source: 'light',
    partyVisible: false,
  };

  it('exposes the lit lights as the glow filter for players', () => {
    const { result } = setup();
    act(() => {
      result.current.handleVisionUpdated(payload({ polygons: [polygon, seenTorch] }));
      result.current.applyPendingPolygons();
    });
    expect([...(result.current.visibleLightIds ?? [])]).toEqual(['torch']);
  });

  it('lets the DM see every light outside the player-view preview', () => {
    const { canvas, result } = setup(true, { canSeeAllLights: true });
    act(() => {
      result.current.handleVisionUpdated(payload({ polygons: [seenTorch, hiddenFire] }));
      result.current.applyPendingPolygons();
    });
    expect(result.current.visibleLightIds).toBeNull();
    expect(canvas.setVisibilityPolygons).toHaveBeenLastCalledWith([seenTorch, hiddenFire]);
  });

  it('hides lights behind walls in the DM player-view preview', () => {
    const { canvas, result } = setup(true, { partyViewOnly: true });
    act(() => {
      result.current.handleVisionUpdated(payload({ polygons: [seenTorch, hiddenFire] }));
      result.current.applyPendingPolygons();
    });
    expect(canvas.setVisibilityPolygons).toHaveBeenLastCalledWith([seenTorch]);
    expect([...(result.current.visibleLightIds ?? [])]).toEqual(['torch']);
  });

  it('holds polygons until the matching reveals are applied, doors apply immediately', () => {
    const { canvas, result } = setup();

    act(() => result.current.handleVisionUpdated(payload()));
    expect(canvas.setVisibilityPolygons).toHaveBeenLastCalledWith([]);
    expect(canvas.setDoors).toHaveBeenLastCalledWith([doorA], true);

    act(() => result.current.applyPendingPolygons());
    expect(canvas.setVisibilityPolygons).toHaveBeenLastCalledWith([polygon]);
  });

  it('ignores payloads for another campaign', () => {
    const { canvas, result } = setup();

    act(() => {
      result.current.handleVisionUpdated(payload({ campaignId: 'other' }));
      result.current.applyPendingPolygons();
    });

    expect(canvas.setVisibilityPolygons).toHaveBeenLastCalledWith([]);
    expect(canvas.setDoors).toHaveBeenLastCalledWith([], true);
  });

  it('keeps an early payload for a scene and draws it once that scene is active', () => {
    const { canvas, result, rerender } = setup();

    act(() => {
      result.current.handleVisionUpdated(payload({ sceneId: 's2' }));
      result.current.applyPendingPolygons();
    });
    expect(canvas.setVisibilityPolygons).toHaveBeenLastCalledWith([]);

    rerender({ sceneId: 's2' });
    expect(canvas.setVisibilityPolygons).toHaveBeenLastCalledWith([polygon]);
    expect(canvas.setDoors).toHaveBeenLastCalledWith([doorA], true);
  });

  it('hides every enemy until sight data for the scene is applied', () => {
    const { result, rerender } = setup();
    expect([...(result.current.visibleEnemyTokenIds ?? ['unexpected'])]).toEqual([]);

    act(() => result.current.handleVisionUpdated(payload()));
    expect([...(result.current.visibleEnemyTokenIds ?? ['unexpected'])]).toEqual([]);

    act(() => result.current.applyPendingPolygons());
    expect([...(result.current.visibleEnemyTokenIds ?? [])]).toEqual(['goblin']);

    rerender({ sceneId: 's2' });
    expect([...(result.current.visibleEnemyTokenIds ?? ['unexpected'])]).toEqual([]);
  });

  it('does not filter enemies for the DM view', () => {
    const { result } = setup(true, { hideUnseenEnemies: false });
    act(() => {
      result.current.handleVisionUpdated(payload());
      result.current.applyPendingPolygons();
    });
    expect(result.current.visibleEnemyTokenIds).toBeNull();
  });

  it('flips a door marker immediately on door:toggled', () => {
    const { canvas, result } = setup();
    act(() => result.current.handleVisionUpdated(payload()));

    act(() =>
      result.current.handleDoorToggled({ campaignId: 'c1', sceneId: 's1', wallId: 'door-a', isOpen: true }),
    );

    expect(canvas.setDoors).toHaveBeenLastCalledWith([{ ...doorA, isOpen: true }], true);
  });

  it('marks doors non-interactive for observers', () => {
    const { canvas, result } = setup(false);
    act(() => result.current.handleVisionUpdated(payload()));
    expect(canvas.setDoors).toHaveBeenLastCalledWith([doorA], false);
  });

  it('never draws a previous scene on the new one, and clears on reset', () => {
    const { canvas, result, rerender } = setup();
    act(() => {
      result.current.handleVisionUpdated(payload());
      result.current.applyPendingPolygons();
    });

    rerender({ sceneId: 's2' });
    expect(canvas.setVisibilityPolygons).toHaveBeenLastCalledWith([]);
    expect(canvas.setDoors).toHaveBeenLastCalledWith([], true);

    rerender({ sceneId: 's1' });
    act(() => result.current.reset());
    expect(canvas.setVisibilityPolygons).toHaveBeenLastCalledWith([]);
    expect(canvas.setDoors).toHaveBeenLastCalledWith([], true);
  });

  describe('door selection', () => {
    it('selects a door, tracks its state, and deselects on a second click', () => {
      const { canvas, result } = setup();
      act(() => result.current.handleVisionUpdated(payload()));

      act(() => result.current.handleDoorClick('door-a'));
      expect(result.current.selectedDoor).toEqual(doorA);
      expect(canvas.setSelectedDoor).toHaveBeenLastCalledWith('door-a');

      act(() =>
        result.current.handleDoorToggled({
          campaignId: 'c1',
          sceneId: 's1',
          wallId: 'door-a',
          isOpen: true,
        }),
      );
      expect(result.current.selectedDoor?.isOpen).toBe(true);

      act(() => result.current.handleDoorClick('door-a'));
      expect(result.current.selectedDoor).toBeNull();
      expect(canvas.setSelectedDoor).toHaveBeenLastCalledWith(null);
    });

    it('drops the selection when the door leaves the list or the scene changes', () => {
      const { result, rerender } = setup();
      act(() => result.current.handleVisionUpdated(payload()));
      act(() => result.current.handleDoorClick('door-a'));

      rerender({ sceneId: 's2' });
      expect(result.current.selectedDoor).toBeNull();

      rerender({ sceneId: 's1' });
      expect(result.current.selectedDoor).toBeNull();

      act(() => result.current.handleDoorClick('door-a'));
      act(() => result.current.handleVisionUpdated(payload({ doors: [] })));
      expect(result.current.selectedDoor).toBeNull();
    });

    it('clears the selection explicitly', () => {
      const { result } = setup();
      act(() => result.current.handleVisionUpdated(payload()));
      act(() => result.current.handleDoorClick('door-a'));
      act(() => result.current.clearDoorSelection());
      expect(result.current.selectedDoor).toBeNull();
    });

    it('never exposes a selection to viewers who cannot toggle doors', () => {
      const { result } = setup(false);
      act(() => result.current.handleVisionUpdated(payload()));
      act(() => result.current.handleDoorClick('door-a'));
      expect(result.current.selectedDoor).toBeNull();
    });
  });
});
