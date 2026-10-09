import { act, renderHook, waitFor } from '@testing-library/react';
import type { DragEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LightSource } from '@vtt/shared';

import type { CanvasManager } from '../../play-area/canvas/CanvasManager';
import { LIGHT_DRAG_MIME } from '../utils/light-placement';

const overlays: { visible: boolean; setLights: ReturnType<typeof vi.fn> }[] = [];

vi.mock('../canvas/LightOverlay', () => ({
  LightOverlay: class {
    visible = true;
    destroyed = false;
    setLights = vi.fn();
    removeFromParent = vi.fn();
    destroy = vi.fn();
    constructor() {
      overlays.push(this);
    }
  },
}));

const { useLightEditor } = await import('./useLightEditor');
const { useUndoRedo } = await import('./useUndoRedo');

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const CELL = 64;

function makeLight(overrides: Partial<LightSource> = {}): LightSource {
  return {
    id: 'new',
    sceneId: 's1',
    campaignId: 'c1',
    x: 0,
    y: 0,
    radius: 8,
    color: '#ff9a3c',
    intensity: 0.8,
    falloff: 0.5,
    emitterType: 'torch',
    animationMode: 'flicker',
    animationSeed: 1,
    alwaysVisible: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function routeFetch(created: LightSource, existing: LightSource[] = []): void {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/atmosphere')) {
      return { ok: true, status: 200, json: async () => ({ data: { weatherPreset: 'none' } }) };
    }
    if (init?.method === 'POST') {
      return { ok: true, status: 201, json: async () => ({ data: created }) };
    }
    if (init?.method === 'PATCH') {
      return { ok: true, status: 200, json: async () => ({ data: existing[0] }) };
    }
    return { ok: true, status: 200, json: async () => ({ data: existing }) };
  });
}

function makeCanvasManager(): CanvasManager {
  const container = document.createElement('div');
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  return {
    canvas,
    foregroundLayer: { addChild: vi.fn() },
    screenToWorld: (x: number, y: number) => ({ x, y }),
    getViewportBounds: () => ({ x: 0, y: 0, width: 640, height: 480 }),
  } as unknown as CanvasManager;
}

function dropEvent(data: string, clientX: number, clientY: number, altKey = false): DragEvent<HTMLElement> {
  return {
    dataTransfer: { getData: (type: string) => (type === LIGHT_DRAG_MIME ? data : '') },
    currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
    clientX,
    clientY,
    altKey,
    preventDefault: vi.fn(),
  } as unknown as DragEvent<HTMLElement>;
}

function postBodies(): unknown[] {
  return mockFetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

function render(
  overrides: { isEditorMode?: boolean; isDm?: boolean; canvasManager?: CanvasManager } = {},
) {
  const canvasManager = overrides.canvasManager ?? makeCanvasManager();
  return renderHook(() =>
    useLightEditor({
      campaignId: 'c1',
      sceneId: 's1',
      canvasManager,
      isReady: true,
      isEditorMode: overrides.isEditorMode ?? true,
      isDm: overrides.isDm ?? true,
      cellSize: CELL,
      history: useUndoRedo({ shortcutsEnabled: false }),
    }),
  );
}

describe('useLightEditor', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    overlays.length = 0;
    routeFetch(makeLight());
  });

  it('returns no section props for non-DMs', () => {
    const { result } = render({ isDm: false });
    expect(result.current.sectionProps).toBeNull();
  });

  it('snaps a dropped preset, creates it, and selects it', async () => {
    const { result } = render();
    act(() => result.current.handleDrop(dropEvent('torch', 30, 70)));

    await waitFor(() => expect(result.current.sectionProps?.selectedLightId).toBe('new'));
    expect(postBodies()).toEqual([{ emitterType: 'torch', x: 32, y: 64 }]);
  });

  it('skips snapping with Alt', async () => {
    const { result } = render();
    act(() => result.current.handleDrop(dropEvent('lantern', 30, 70, true)));
    await waitFor(() => expect(postBodies()).toEqual([{ emitterType: 'lantern', x: 30, y: 70 }]));
  });

  it('ignores foreign payloads and drops outside editor mode', () => {
    const editor = render();
    act(() => editor.result.current.handleDrop(dropEvent('{"id":"asset"}', 0, 0)));
    const play = render({ isEditorMode: false });
    act(() => play.result.current.handleDrop(dropEvent('torch', 0, 0)));
    expect(postBodies()).toEqual([]);
  });

  it('adds a preset at the snapped centre of the view', async () => {
    const { result } = render();
    act(() => result.current.sectionProps?.onAddPreset('beacon'));
    await waitFor(() => expect(postBodies()).toEqual([{ emitterType: 'beacon', x: 320, y: 256 }]));
  });

  it('shows the overlay only while authoring with lights visible', () => {
    const { result } = render();
    const overlay = overlays[0];
    expect(overlay.visible).toBe(true);

    act(() => result.current.sectionProps?.onToggleVisibility());
    expect(overlay.visible).toBe(false);

    const play = render({ isEditorMode: false });
    expect(overlays[1].visible).toBe(false);
    expect(play.result.current.sectionProps).not.toBeNull();
  });

  describe('dragging a placed light', () => {
    function pointer(type: string, clientX: number, clientY: number): MouseEvent {
      return new MouseEvent(type, { button: 0, clientX, clientY, bubbles: true, cancelable: true });
    }

    function patchBodies(): unknown[] {
      return mockFetch.mock.calls
        .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')
        .map(([, init]) => JSON.parse((init as RequestInit).body as string));
    }

    async function setup(): Promise<{
      canvas: HTMLCanvasElement;
      result: ReturnType<typeof render>['result'];
    }> {
      routeFetch(makeLight(), [makeLight({ id: 'l1', x: 96, y: 96 })]);
      const canvasManager = makeCanvasManager();
      const { result } = render({ canvasManager });
      await waitFor(() => expect(result.current.sectionProps?.lights).toHaveLength(1));
      return { canvas: canvasManager.canvas, result };
    }

    it('selects the light, previews the snapped move, and saves on release', async () => {
      const { canvas, result } = await setup();
      const pixiDown = vi.fn();
      canvas.addEventListener('pointerdown', pixiDown);

      act(() => {
        canvas.dispatchEvent(pointer('pointerdown', 100, 100));
      });
      expect(pixiDown).not.toHaveBeenCalled();
      expect(result.current.sectionProps?.selectedLightId).toBe('l1');

      act(() => {
        window.dispatchEvent(pointer('pointermove', 130, 135));
      });
      expect(overlays[0].setLights).toHaveBeenLastCalledWith(
        [expect.objectContaining({ id: 'l1', x: 128, y: 128 })],
        'l1',
        CELL,
      );

      act(() => {
        window.dispatchEvent(pointer('pointerup', 130, 135));
      });
      expect(result.current.sectionProps?.lights[0]).toMatchObject({ x: 128, y: 128 });
      await waitFor(() => expect(patchBodies()).toEqual([{ x: 128, y: 128 }]));
    });

    it('treats a press without movement as a selection only', async () => {
      const { canvas, result } = await setup();
      act(() => {
        canvas.dispatchEvent(pointer('pointerdown', 96, 96));
        window.dispatchEvent(pointer('pointerup', 97, 96));
      });
      expect(result.current.sectionProps?.selectedLightId).toBe('l1');
      expect(result.current.sectionProps?.lights[0]).toMatchObject({ x: 96, y: 96 });
    });

    it('lets presses away from any light reach the canvas', async () => {
      const { canvas } = await setup();
      const pixiDown = vi.fn();
      canvas.addEventListener('pointerdown', pixiDown);
      act(() => {
        canvas.dispatchEvent(pointer('pointerdown', 300, 300));
      });
      expect(pixiDown).toHaveBeenCalledOnce();
    });
  });
});
