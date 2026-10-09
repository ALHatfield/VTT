import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { WallSegment } from '@vtt/shared';

import type { WallsSectionProps } from './WallsSection';
import { WallsSection } from './WallsSection';

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

function setup(overrides: Partial<WallsSectionProps> = {}): WallsSectionProps {
  const props: WallsSectionProps = {
    walls: [makeWall(), makeWall({ id: 'w2', isDoor: true, isOpen: true })],
    selectedWallId: null,
    wallsVisible: true,
    isToolActive: false,
    snapToGrid: false,
    error: null,
    onToggleTool: vi.fn(),
    onDeactivateTool: vi.fn(),
    onToggleSnap: vi.fn(),
    onToggleVisibility: vi.fn(),
    onSelectWall: vi.fn(),
    onDeleteWall: vi.fn(),
    onDeleteAll: vi.fn(),
    onUpdateWall: vi.fn(),
    ...overrides,
  };
  render(<WallsSection {...props} />);
  return props;
}

describe('WallsSection', () => {
  it('lists walls with their kind and door state', () => {
    setup();
    expect(screen.getByText('Wall 1')).toBeInTheDocument();
    expect(screen.getByText(/Door 2/)).toHaveTextContent('Door 2 (open)');
  });

  it('shows an empty state and hides bulk delete when there are no walls', () => {
    setup({ walls: [] });
    expect(screen.getByText('No walls on this scene.')).toBeInTheDocument();
    expect(screen.queryByText('Delete all walls')).not.toBeInTheDocument();
  });

  it('toggles the wall tool and shows usage hints when active', () => {
    const props = setup({ isToolActive: true });
    fireEvent.click(screen.getByRole('button', { name: 'Drawing walls' }));
    expect(props.onToggleTool).toHaveBeenCalled();
    expect(screen.getByText(/Hold Alt to snap to grid/)).toBeInTheDocument();
  });

  it('toggles grid snapping, off by default', () => {
    const props = setup({ isToolActive: true });
    const checkbox = screen.getByLabelText('Snap to grid');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(props.onToggleSnap).toHaveBeenCalled();
  });

  it('describes Alt as free drawing when snapping is on', () => {
    setup({ isToolActive: true, snapToGrid: true });
    expect(screen.getByText(/Hold Alt to draw freely/)).toBeInTheDocument();
  });

  it('toggles wall visibility with a stable pressed-state label', () => {
    const props = setup();
    const button = screen.getByRole('button', { name: 'Show walls' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(props.onToggleVisibility).toHaveBeenCalled();
  });

  it('selects a wall from the list via its row button', () => {
    const props = setup({ selectedWallId: 'w2' });
    const row = screen.getByRole('button', { name: 'Wall 1' });
    expect(row).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(row);
    expect(props.onSelectWall).toHaveBeenCalledWith('w1');
  });

  it('deletes a wall from its row without selecting it', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Wall 1' }));
    expect(props.onDeleteWall).toHaveBeenCalledWith('w1');
    expect(props.onSelectWall).not.toHaveBeenCalled();
  });

  it('requires confirmation before bulk delete', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete all walls' }));
    expect(props.onDeleteAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete 2' }));
    expect(props.onDeleteAll).toHaveBeenCalledTimes(1);
  });

  it('cancels bulk delete', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete all walls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onDeleteAll).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete all walls' })).toBeInTheDocument();
  });

  it('surfaces request errors', () => {
    setup({ error: 'Failed to create wall' });
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to create wall');
  });
});

describe('WallInspector (via WallsSection)', () => {
  it('prompts for a selection when none exists', () => {
    setup();
    expect(screen.getByText('Select a wall to edit its properties.')).toBeInTheDocument();
  });

  it('updates blocking flags independently', () => {
    const props = setup({ selectedWallId: 'w1' });
    fireEvent.click(screen.getByLabelText('Blocks light'));
    expect(props.onUpdateWall).toHaveBeenCalledWith('w1', { blocksLight: false });
    fireEvent.click(screen.getByLabelText('Blocks movement'));
    expect(props.onUpdateWall).toHaveBeenCalledWith('w1', { blocksMovement: false });
  });

  it('marks a wall as a door', () => {
    const props = setup({ selectedWallId: 'w1' });
    expect(screen.queryByRole('group', { name: 'Door state' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Door'));
    expect(props.onUpdateWall).toHaveBeenCalledWith('w1', { isDoor: true });
  });

  it('toggles door open/closed state', () => {
    const props = setup({ selectedWallId: 'w2' });
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Closed' }));
    expect(props.onUpdateWall).toHaveBeenCalledWith('w2', { isOpen: false });
  });

  it('closes the door when unmarking it', () => {
    const props = setup({ selectedWallId: 'w2' });
    fireEvent.click(screen.getByLabelText('Door'));
    expect(props.onUpdateWall).toHaveBeenCalledWith('w2', { isDoor: false, isOpen: false });
  });

  it('deletes the selected wall', () => {
    const props = setup({ selectedWallId: 'w1' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete wall' }));
    expect(props.onDeleteWall).toHaveBeenCalledWith('w1');
  });
});
