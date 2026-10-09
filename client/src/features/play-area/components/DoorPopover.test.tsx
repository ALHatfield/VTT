import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DoorState } from '@vtt/shared';

import type { CanvasManager } from '../canvas/CanvasManager';

import { DoorPopover } from './DoorPopover';

const closedDoor: DoorState = { id: 'door-a', x1: 0, y1: 0, x2: 64, y2: 0, isOpen: false };

function mockCanvas(): CanvasManager {
  let offset = 0;
  const canvas = {
    onViewportChange: undefined as (() => void) | undefined,
    worldToScreen: vi.fn((x: number, y: number) => ({ x: x + offset, y })),
    pan(dx: number): void {
      offset += dx;
      canvas.onViewportChange?.();
    },
  };
  return canvas as unknown as CanvasManager;
}

function renderPopover(door = closedDoor): {
  canvas: CanvasManager;
  onToggle: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
  unmount: () => void;
} {
  const canvas = mockCanvas();
  const onToggle = vi.fn();
  const onClose = vi.fn();
  const { unmount } = render(
    <DoorPopover door={door} canvasManager={canvas} onToggle={onToggle} onClose={onClose} />,
  );
  return { canvas, onToggle, onClose, unmount };
}

describe('DoorPopover', () => {
  it('offers Open for a closed door and Close for an open one', () => {
    renderPopover();
    expect(screen.getByText(/Door · Closed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open/ })).toBeInTheDocument();
  });

  it('labels an open door', () => {
    renderPopover({ ...closedDoor, isOpen: true });
    expect(screen.getByText(/Door · Open/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
  });

  it('toggles from the button', () => {
    const { onToggle } = renderPopover();
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('toggles on E and closes on Escape', () => {
    const { onToggle, onClose } = renderPopover();
    fireEvent.keyDown(window, { key: 'e' });
    fireEvent.keyDown(window, { key: 'E' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores the hotkey while typing or with modifiers', () => {
    const { onToggle } = renderPopover();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'e' });
    fireEvent.keyDown(window, { key: 'e', ctrlKey: true });
    expect(onToggle).not.toHaveBeenCalled();
    input.remove();
  });

  it('anchors to the door midpoint and follows the viewport', () => {
    const { canvas, unmount } = renderPopover();
    const popover = screen.getByRole('dialog', { name: 'Door' });
    expect(popover.style.left).toBe('32px');

    act(() => (canvas as unknown as { pan: (dx: number) => void }).pan(10));
    expect(popover.style.left).toBe('42px');

    unmount();
    expect(canvas.onViewportChange).toBeUndefined();
  });
});
