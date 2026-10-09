import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WallSegment } from '@vtt/shared';

import type { WallToolOverlayProps } from './WallToolOverlay';
import { WallToolOverlay } from './WallToolOverlay';

const CELL = 64;

function makeWall(overrides: Partial<WallSegment> = {}): WallSegment {
  return {
    id: 'w1',
    sceneId: 's',
    campaignId: 'c',
    x1: 0,
    y1: 0,
    x2: 128,
    y2: 0,
    blocksLight: true,
    blocksMovement: true,
    isDoor: false,
    isOpen: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function setup(overrides: Partial<WallToolOverlayProps> = {}): WallToolOverlayProps {
  const props: WallToolOverlayProps = {
    walls: [],
    selectedWallId: null,
    cellSize: CELL,
    snapToGrid: true,
    toWorld: (x, y) => ({ x, y }),
    onPan: vi.fn(),
    onCreateSegment: vi.fn(),
    onSelectWall: vi.fn(),
    onMoveEndpoint: vi.fn(),
    onDeleteWall: vi.fn(),
    onDraftChange: vi.fn(),
    ...overrides,
  };
  render(<WallToolOverlay {...props} />);
  return props;
}

function overlay(): HTMLElement {
  return screen.getByTestId('wall-tool-overlay');
}

function down(x: number, y: number, init: PointerEventInit = {}): void {
  fireEvent.pointerDown(overlay(), { clientX: x, clientY: y, button: 0, ...init });
}

beforeAll(() => {
  // jsdom lacks PointerEvent and pointer capture
  if (!('PointerEvent' in window)) {
    class PointerEventPolyfill extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    Object.defineProperty(window, 'PointerEvent', { value: PointerEventPolyfill });
  }
  HTMLElement.prototype.setPointerCapture = vi.fn();
});

describe('WallToolOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('places grid-snapped vertices and creates a segment per click', () => {
    const props = setup();

    down(10, 5);
    down(70, 3);
    down(70, 60);

    expect(props.onCreateSegment).toHaveBeenNthCalledWith(1, { x: 0, y: 0 }, { x: 64, y: 0 });
    expect(props.onCreateSegment).toHaveBeenNthCalledWith(2, { x: 64, y: 0 }, { x: 64, y: 64 });
  });

  it('bypasses snapping while Alt is held', () => {
    const props = setup();

    down(10, 5, { altKey: true });
    down(70, 3, { altKey: true });

    expect(props.onCreateSegment).toHaveBeenCalledWith({ x: 10, y: 5 }, { x: 70, y: 3 });
  });

  describe('free drawing (snap off)', () => {
    it('places points where clicked, rounded to whole pixels', () => {
      const props = setup({ snapToGrid: false });

      down(10.4, 5.6);
      down(70, 3);

      expect(props.onCreateSegment).toHaveBeenCalledWith({ x: 10, y: 6 }, { x: 70, y: 3 });
    });

    it('snaps to the grid while Alt is held', () => {
      const props = setup({ snapToGrid: false });

      down(10, 5, { altKey: true });
      down(70, 3, { altKey: true });

      expect(props.onCreateSegment).toHaveBeenCalledWith({ x: 0, y: 0 }, { x: 64, y: 0 });
    });

    it('joins a chain to a nearby existing wall end', () => {
      const props = setup({ snapToGrid: false, walls: [makeWall()] });

      down(200, 100);
      down(131, 4);

      expect(props.onCreateSegment).toHaveBeenCalledWith({ x: 200, y: 100 }, { x: 128, y: 0 });
    });

    it('joins a dragged endpoint to another wall but not to its own vertices', () => {
      const other = makeWall({ id: 'w2', x1: 200, y1: 200, x2: 300, y2: 200 });
      const props = setup({ snapToGrid: false, walls: [makeWall(), other], selectedWallId: 'w1' });

      down(126, 2);
      fireEvent.pointerMove(overlay(), { clientX: 203, clientY: 197 });
      fireEvent.pointerUp(overlay(), { clientX: 203, clientY: 197, button: 0 });

      expect(props.onMoveEndpoint).toHaveBeenCalledWith('w1', 'end', { x: 200, y: 200 });
    });
  });

  it('skips zero-length segments when clicking the same snapped point', () => {
    const props = setup();

    down(10, 5);
    down(12, 4);

    expect(props.onCreateSegment).not.toHaveBeenCalled();
  });

  it('previews the next segment while moving', () => {
    const props = setup();

    down(0, 0);
    fireEvent.pointerMove(overlay(), { clientX: 130, clientY: 2 });

    expect(props.onDraftChange).toHaveBeenLastCalledWith({
      start: { x: 0, y: 0 },
      end: { x: 128, y: 0 },
    });
  });

  it('selects an existing wall instead of drawing', () => {
    const props = setup({ walls: [makeWall()] });

    down(64, 3);
    down(64, 100);

    expect(props.onSelectWall).toHaveBeenCalledWith('w1');
    expect(props.onCreateSegment).not.toHaveBeenCalled();
  });

  it('Shift+click starts a chain on top of an existing wall', () => {
    const props = setup({ walls: [makeWall()] });

    down(128, 0, { shiftKey: true });
    down(128, 64);

    expect(props.onCreateSegment).toHaveBeenCalledWith({ x: 128, y: 0 }, { x: 128, y: 64 });
  });

  it('drags an endpoint and commits the snapped position on release', () => {
    const props = setup({ walls: [makeWall()], selectedWallId: 'w1' });

    down(126, 2);
    fireEvent.pointerMove(overlay(), { clientX: 190, clientY: 5 });
    fireEvent.pointerUp(overlay(), { clientX: 190, clientY: 5, button: 0 });

    expect(props.onDraftChange).toHaveBeenCalledWith({
      start: { x: 0, y: 0 },
      end: { x: 192, y: 0 },
      replacesWallId: 'w1',
    });
    expect(props.onMoveEndpoint).toHaveBeenCalledWith('w1', 'end', { x: 192, y: 0 });
    expect(props.onDraftChange).toHaveBeenLastCalledWith(null);
  });

  it('does not commit an endpoint drag that collapses the wall', () => {
    const props = setup({ walls: [makeWall()], selectedWallId: 'w1' });

    down(126, 2);
    fireEvent.pointerMove(overlay(), { clientX: 3, clientY: 1 });
    fireEvent.pointerUp(overlay(), { clientX: 3, clientY: 1, button: 0 });

    expect(props.onMoveEndpoint).not.toHaveBeenCalled();
  });

  it('deletes the selected wall with the Delete key', () => {
    const props = setup({ walls: [makeWall()], selectedWallId: 'w1' });

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(props.onDeleteWall).toHaveBeenCalledWith('w1');
  });

  it('ignores Delete while typing in an input', () => {
    const props = setup({ walls: [makeWall()], selectedWallId: 'w1' });
    const input = document.createElement('input');
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: 'Delete' });

    expect(props.onDeleteWall).not.toHaveBeenCalled();
    input.remove();
  });

  it('ignores Backspace while a panel button has focus', () => {
    const props = setup({ walls: [makeWall()], selectedWallId: 'w1' });
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    fireEvent.keyDown(button, { key: 'Backspace' });

    expect(props.onDeleteWall).not.toHaveBeenCalled();
    button.remove();
  });

  it('ignores Delete with a modifier held', () => {
    const props = setup({ walls: [makeWall()], selectedWallId: 'w1' });

    fireEvent.keyDown(window, { key: 'Backspace', metaKey: true });

    expect(props.onDeleteWall).not.toHaveBeenCalled();
  });

  it('pans with the middle mouse button without placing vertices', () => {
    const props = setup();

    fireEvent.pointerDown(overlay(), { clientX: 10, clientY: 10, button: 1 });
    fireEvent.pointerMove(overlay(), { clientX: 25, clientY: 5 });
    fireEvent.pointerUp(overlay(), { clientX: 25, clientY: 5, button: 1 });

    expect(props.onPan).toHaveBeenCalledWith(15, -5);
    expect(props.onDraftChange).not.toHaveBeenCalled();
  });

  it('focuses itself on pointer down so Delete routes to the canvas', () => {
    setup();
    down(0, 0);
    expect(document.activeElement).toBe(overlay());
  });

  it('Escape finishes the chain without creating a segment', () => {
    const props = setup();

    down(0, 0);
    fireEvent.keyDown(window, { key: 'Escape' });
    down(64, 0);

    expect(props.onCreateSegment).not.toHaveBeenCalled();
    expect(props.onDraftChange).toHaveBeenCalledWith(null);
  });

  it('double-click finishes the chain', () => {
    const props = setup();

    down(0, 0);
    down(64, 0);
    fireEvent.doubleClick(overlay());
    down(128, 0);

    expect(props.onCreateSegment).toHaveBeenCalledTimes(1);
  });

  it('pans with a right-button drag', () => {
    const props = setup();

    down(100, 100, { button: 2 });
    fireEvent.pointerMove(overlay(), { clientX: 110, clientY: 95 });

    expect(props.onPan).toHaveBeenCalledWith(10, -5);
    expect(props.onCreateSegment).not.toHaveBeenCalled();
  });
});
