// SceneStrip tests — Phase 5H
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SceneSummary } from '@vtt/shared';

import type { SceneStripProps } from './SceneStrip';
import { SceneStrip } from './SceneStrip';

function makeScene(overrides: Partial<SceneSummary> = {}): SceneSummary {
  return {
    id: 's-1',
    campaignId: 'c-1',
    name: 'Scene 1',
    imageUrl: null,
    width: 2048,
    height: 2048,
    cellSize: 64,
    isActive: false,
    sortOrder: 0,
    thumbnailUrl: null,
    weatherPreset: 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function setup(overrides: Partial<SceneStripProps> = {}): SceneStripProps {
  const props: SceneStripProps = {
    scenes: [
      makeScene({ id: 's-1', name: 'Tavern', isActive: true }),
      makeScene({ id: 's-2', name: 'Dungeon', sortOrder: 1 }),
    ],
    editedSceneId: 's-1',
    isLoading: false,
    error: null,
    saveStatus: 'idle',
    onRetrySave: vi.fn(),
    onSelectScene: vi.fn(),
    onCreateScene: vi.fn(),
    onRenameScene: vi.fn(),
    onDuplicateScene: vi.fn(),
    onDeleteScene: vi.fn(),
    onReorderScenes: vi.fn(),
    ...overrides,
  };
  render(<SceneStrip {...props} />);
  return props;
}

describe('SceneStrip', () => {
  it('renders a card per scene with the active badge', () => {
    setup();
    expect(screen.getByText('Tavern')).toBeInTheDocument();
    expect(screen.getByText('Dungeon')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('selects a scene on card click', () => {
    const { onSelectScene } = setup();
    fireEvent.click(screen.getByText('Dungeon'));
    expect(onSelectScene).toHaveBeenCalledWith('s-2');
  });

  it('creates a scene from the create button', () => {
    const { onCreateScene } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ New scene' }));
    expect(onCreateScene).toHaveBeenCalled();
  });

  it('renames inline on double-click, committing with Enter', () => {
    const { onRenameScene } = setup();
    fireEvent.doubleClick(screen.getByText('Dungeon'));
    const input = screen.getByLabelText('Scene name');
    fireEvent.change(input, { target: { value: 'Dungeon Depths' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameScene).toHaveBeenCalledWith('s-2', 'Dungeon Depths');
  });

  it('cancels an inline rename with Escape', () => {
    const { onRenameScene } = setup();
    fireEvent.doubleClick(screen.getByText('Dungeon'));
    const input = screen.getByLabelText('Scene name');
    fireEvent.change(input, { target: { value: 'Nope' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRenameScene).not.toHaveBeenCalled();
  });

  it('duplicates a scene from the context menu', () => {
    const { onDuplicateScene } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Scene options for Dungeon' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(onDuplicateScene).toHaveBeenCalledWith('s-2');
  });

  it('requires confirmation before deleting', () => {
    const { onDeleteScene } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Scene options for Dungeon' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }));
    expect(onDeleteScene).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Confirm delete' }));
    expect(onDeleteScene).toHaveBeenCalledWith('s-2');
  });

  it('disables delete for the active scene', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Scene options for Tavern' }));
    expect(screen.getByRole('menuitem', { name: 'Delete…' })).toBeDisabled();
  });

  it('disables delete for the last remaining scene', () => {
    setup({ scenes: [makeScene({ id: 's-only', name: 'Only' })], editedSceneId: 's-only' });
    fireEvent.click(screen.getByRole('button', { name: 'Scene options for Only' }));
    expect(screen.getByRole('menuitem', { name: 'Delete…' })).toBeDisabled();
  });

  it('reorders scenes by dragging a card onto another', () => {
    const { onReorderScenes } = setup();
    const dungeon = screen.getByText('Dungeon').closest('div[draggable]') as HTMLElement;
    const tavern = screen.getByText('Tavern').closest('div[draggable]') as HTMLElement;

    fireEvent.dragStart(dungeon);
    fireEvent.dragOver(tavern);
    fireEvent.drop(tavern);

    expect(onReorderScenes).toHaveBeenCalledWith(['s-2', 's-1']);
  });

  it('shows the save status indicator', () => {
    setup({ saveStatus: 'saving' });
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });

  it('offers retry when saving failed', () => {
    const { onRetrySave } = setup({ saveStatus: 'error' });
    expect(screen.getByText('Save failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetrySave).toHaveBeenCalled();
  });

  it('surfaces scene library errors', () => {
    setup({ error: 'Failed to load scenes' });
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load scenes');
  });
});
