// LayersPanel tests — Phase 5C
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { TileAsset, TilePlacement } from '@vtt/shared';

import { LayersPanel } from './LayersPanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlacement(overrides: Partial<TilePlacement> = {}): TilePlacement {
  return {
    id: 'p-1',
    sceneId: 'scene-1',
    assetId: 'asset-1',
    campaignId: 'campaign-1',
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    rotation: 0,
    zIndex: 0,
    category: 'background',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAsset(overrides: Partial<TileAsset> = {}): TileAsset {
  return {
    id: 'asset-1',
    campaignId: 'campaign-1',
    filename: 'grass.png',
    url: '/assets/grass.png',
    thumbnailUrl: '/thumbs/grass.png',
    width: 64,
    height: 64,
    category: 'background',
    source: 'builtin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function defaultProps(
  overrides: Partial<Parameters<typeof LayersPanel>[0]> = {},
): Parameters<typeof LayersPanel>[0] {
  return {
    placements: [],
    selectedTilePlacementIds: new Set(),
    hiddenTileIds: new Set(),
    lockedTileIds: new Set(),
    assets: new Map(),
    canvasGridSize: 64,
    onSelectTile: vi.fn(),
    onToggleVisibility: vi.fn(),
    onToggleLock: vi.fn(),
    onDeleteTile: vi.fn(),
    onReorderTile: vi.fn(),
    onUpdateTile: vi.fn(),
    onDeleteSelectedTiles: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// LayersPanel
// ---------------------------------------------------------------------------

describe('LayersPanel', () => {
  it('renders the layer tabs', () => {
    render(<LayersPanel {...defaultProps()} />);
    expect(screen.getByRole('tab', { name: 'BG' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'FG' })).toBeInTheDocument();
  });

  it('shows placeholder when no tiles in active tab', () => {
    render(<LayersPanel {...defaultProps()} />);
    expect(screen.getByText(/no tiles in this layer/i)).toBeInTheDocument();
  });

  it('renders tiles belonging to the active tab (background by default)', () => {
    const asset = makeAsset({ id: 'asset-1', filename: 'grass.png' });
    const p = makePlacement({ id: 'p-1', category: 'background', assetId: 'asset-1' });
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p],
          assets: new Map([['asset-1', asset]]),
        })}
      />,
    );
    expect(screen.getByText('grass.png')).toBeInTheDocument();
  });

  it('does not show tiles from a different category', () => {
    const asset = makeAsset({ id: 'asset-1', filename: 'token.png' });
    const p = makePlacement({ id: 'p-1', category: 'playground', assetId: 'asset-1' });
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p],
          assets: new Map([['asset-1', asset]]),
        })}
      />,
    );
    // Playground tile should not appear on BG tab
    expect(screen.queryByText('token.png')).not.toBeInTheDocument();
  });

  it('switches to the foreground tab on click', async () => {
    const fgAsset = makeAsset({ id: 'fg-asset', filename: 'fog.png' });
    const fgPlacement = makePlacement({ id: 'p-fg', category: 'foreground', assetId: 'fg-asset' });
    render(
      <LayersPanel
        {...defaultProps({
          placements: [fgPlacement],
          assets: new Map([['fg-asset', fgAsset]]),
        })}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'FG' }));
    expect(screen.getByText('fog.png')).toBeInTheDocument();
  });

  it('sorts tiles by z-index descending (highest z-index first)', () => {
    const a1 = makeAsset({ id: 'a1', filename: 'low.png' });
    const a2 = makeAsset({ id: 'a2', filename: 'high.png' });
    const p1 = makePlacement({ id: 'p1', assetId: 'a1', zIndex: 1 });
    const p2 = makePlacement({ id: 'p2', assetId: 'a2', zIndex: 5 });
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p1, p2],
          assets: new Map([
            ['a1', a1],
            ['a2', a2],
          ]),
        })}
      />,
    );
    const items = screen.getAllByRole('option');
    // First item should be the high z-index one
    expect(items[0]).toHaveTextContent('high.png');
    expect(items[1]).toHaveTextContent('low.png');
  });

  it('calls onToggleVisibility when visibility button is clicked', async () => {
    const onToggleVisibility = vi.fn();
    const asset = makeAsset();
    const p = makePlacement();
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p],
          assets: new Map([['asset-1', asset]]),
          onToggleVisibility,
        })}
      />,
    );
    await userEvent.click(screen.getByLabelText('Hide tile'));
    expect(onToggleVisibility).toHaveBeenCalledWith('p-1');
  });

  it('shows "Show tile" label when tile is hidden', () => {
    const asset = makeAsset();
    const p = makePlacement();
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p],
          assets: new Map([['asset-1', asset]]),
          hiddenTileIds: new Set(['p-1']),
        })}
      />,
    );
    expect(screen.getByLabelText('Show tile')).toBeInTheDocument();
  });

  it('calls onToggleLock when lock button is clicked', async () => {
    const onToggleLock = vi.fn();
    const asset = makeAsset();
    const p = makePlacement();
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p],
          assets: new Map([['asset-1', asset]]),
          onToggleLock,
        })}
      />,
    );
    await userEvent.click(screen.getByLabelText('Lock tile'));
    expect(onToggleLock).toHaveBeenCalledWith('p-1');
  });

  it('shows "Unlock tile" label when tile is locked', () => {
    const asset = makeAsset();
    const p = makePlacement();
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p],
          assets: new Map([['asset-1', asset]]),
          lockedTileIds: new Set(['p-1']),
        })}
      />,
    );
    expect(screen.getByLabelText('Unlock tile')).toBeInTheDocument();
  });

  it('calls onDeleteTile when delete button is clicked', async () => {
    const onDeleteTile = vi.fn();
    const asset = makeAsset();
    const p = makePlacement();
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p],
          assets: new Map([['asset-1', asset]]),
          onDeleteTile,
        })}
      />,
    );
    await userEvent.click(screen.getByLabelText('Delete tile'));
    expect(onDeleteTile).toHaveBeenCalledWith('p-1');
  });

  it('calls onSelectTile when a tile row is clicked', async () => {
    const onSelectTile = vi.fn();
    const asset = makeAsset();
    const p = makePlacement();
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p],
          assets: new Map([['asset-1', asset]]),
          onSelectTile,
        })}
      />,
    );
    await userEvent.click(screen.getByText('grass.png'));
    expect(onSelectTile).toHaveBeenCalledWith('p-1');
  });

  it('renders the inspector "Select a tile" message when nothing is selected', () => {
    const asset = makeAsset();
    const p = makePlacement();
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p],
          assets: new Map([['asset-1', asset]]),
        })}
      />,
    );
    expect(screen.getByText(/select a tile to inspect/i)).toBeInTheDocument();
  });

  it('renders inspector fields when a tile is selected', () => {
    const asset = makeAsset();
    const p = makePlacement({ id: 'p-1', x: 10, y: 20 });
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p],
          assets: new Map([['asset-1', asset]]),
          selectedTilePlacementIds: new Set(['p-1']),
        })}
      />,
    );
    expect(screen.getByLabelText('X')).toHaveValue(10);
    expect(screen.getByLabelText('Y')).toHaveValue(20);
  });

  it('calls onReorderTile with dragged and target ids on drop', () => {
    const onReorderTile = vi.fn();
    const a1 = makeAsset({ id: 'a1', filename: 'tile1.png' });
    const a2 = makeAsset({ id: 'a2', filename: 'tile2.png' });
    const p1 = makePlacement({ id: 'p1', assetId: 'a1', zIndex: 1 });
    const p2 = makePlacement({ id: 'p2', assetId: 'a2', zIndex: 2 });
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p1, p2],
          assets: new Map([
            ['a1', a1],
            ['a2', a2],
          ]),
          onReorderTile,
        })}
      />,
    );
    const items = screen.getAllByRole('option');
    // Mock dataTransfer to satisfy jsdom limitations
    const dt = { effectAllowed: '', setData: vi.fn() };
    fireEvent.dragStart(items[0], { dataTransfer: dt });
    fireEvent.drop(items[1], {
      dataTransfer: { dropEffect: 'move' },
      preventDefault: vi.fn(),
    });
    expect(onReorderTile).toHaveBeenCalledWith(expect.any(String), expect.any(String));
  });

  it('tile rows are keyboard selectable via Enter', async () => {
    const onSelectTile = vi.fn();
    const asset = makeAsset();
    const p = makePlacement();
    render(
      <LayersPanel
        {...defaultProps({
          placements: [p],
          assets: new Map([['asset-1', asset]]),
          onSelectTile,
        })}
      />,
    );
    const row = screen.getByRole('option');
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelectTile).toHaveBeenCalledWith('p-1');
  });
});
