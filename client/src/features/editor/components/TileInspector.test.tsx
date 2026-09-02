// TileInspector tests — Phase 5C
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { TileAsset, TilePlacement } from '@vtt/shared';

import { TileInspector, calcScaledDimensions } from './TileInspector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlacement(overrides: Partial<TilePlacement> = {}): TilePlacement {
  return {
    id: 'p-1',
    sceneId: 'scene-1',
    assetId: 'asset-1',
    campaignId: 'campaign-1',
    x: 128,
    y: 256,
    width: 512,
    height: 512,
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
    filename: 'dungeon.png',
    url: '/assets/dungeon.png',
    thumbnailUrl: '/thumbs/dungeon.png',
    width: 1024,
    height: 1024,
    category: 'background',
    source: 'uploaded',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAssetsMap(assets: TileAsset[] = []): Map<string, TileAsset> {
  return new Map(assets.map((a) => [a.id, a]));
}

// ---------------------------------------------------------------------------
// calcScaledDimensions — pure function
// ---------------------------------------------------------------------------

describe('calcScaledDimensions', () => {
  it('scales asset dimensions by canvasGridSize / assetGridSize', () => {
    // canvas grid = 64px, asset grid cell = 128px → scale = 0.5
    const result = calcScaledDimensions(1024, 1024, 64, 128);
    expect(result).toEqual({ width: 512, height: 512 });
  });

  it('upscales when canvas grid is larger than asset grid', () => {
    // canvas = 128, asset = 64 → scale = 2
    const result = calcScaledDimensions(256, 128, 128, 64);
    expect(result).toEqual({ width: 512, height: 256 });
  });

  it('returns original dimensions when assetGridSize is 0', () => {
    const result = calcScaledDimensions(100, 200, 64, 0);
    expect(result).toEqual({ width: 100, height: 200 });
  });

  it('returns original dimensions when assetGridSize is negative', () => {
    const result = calcScaledDimensions(100, 200, 64, -10);
    expect(result).toEqual({ width: 100, height: 200 });
  });

  it('rounds fractional results', () => {
    // scale = 64 / 3 ≈ 21.33; 100 * 21.33 ≈ 2133
    const result = calcScaledDimensions(100, 100, 64, 3);
    expect(result.width).toBe(Math.round((100 * 64) / 3));
    expect(result.height).toBe(Math.round((100 * 64) / 3));
  });

  it('exact 1:1 scale when canvas equals asset grid size', () => {
    const result = calcScaledDimensions(256, 128, 64, 64);
    expect(result).toEqual({ width: 256, height: 128 });
  });
});

// ---------------------------------------------------------------------------
// TileInspector component
// ---------------------------------------------------------------------------

describe('TileInspector', () => {
  it('shows "Select a tile" message when no selection', () => {
    render(
      <TileInspector
        selectedPlacements={[]}
        assets={makeAssetsMap()}
        canvasGridSize={64}
        onUpdate={vi.fn()}
        onDeleteAll={vi.fn()}
      />,
    );
    expect(screen.getByText(/select a tile/i)).toBeInTheDocument();
  });

  it('shows single-tile fields with seeded values', () => {
    const placement = makePlacement({
      x: 100,
      y: 200,
      width: 300,
      height: 400,
      rotation: 90,
      zIndex: 5,
    });
    render(
      <TileInspector
        selectedPlacements={[placement]}
        assets={makeAssetsMap([makeAsset()])}
        canvasGridSize={64}
        onUpdate={vi.fn()}
        onDeleteAll={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('X')).toHaveValue(100);
    expect(screen.getByLabelText('Y')).toHaveValue(200);
    expect(screen.getByLabelText('W')).toHaveValue(300);
    expect(screen.getByLabelText('H')).toHaveValue(400);
    expect(screen.getByLabelText('Rot')).toHaveValue(90);
    expect(screen.getByLabelText('Z')).toHaveValue(5);
  });

  it('calls onUpdate with new x when x field is committed', async () => {
    const onUpdate = vi.fn();
    const placement = makePlacement({ x: 0 });
    render(
      <TileInspector
        selectedPlacements={[placement]}
        assets={makeAssetsMap([makeAsset()])}
        canvasGridSize={64}
        onUpdate={onUpdate}
        onDeleteAll={vi.fn()}
      />,
    );
    const xInput = screen.getByLabelText('X');
    await userEvent.clear(xInput);
    await userEvent.type(xInput, '256');
    await userEvent.keyboard('{Enter}');
    expect(onUpdate).toHaveBeenCalledWith('p-1', { x: 256 });
  });

  it('calls onUpdate with scaled dimensions when grid cell size is committed', async () => {
    const onUpdate = vi.fn();
    const placement = makePlacement({ assetId: 'asset-1' });
    const asset = makeAsset({ id: 'asset-1', width: 1024, height: 1024 });
    render(
      <TileInspector
        selectedPlacements={[placement]}
        assets={makeAssetsMap([asset])}
        canvasGridSize={64}
        onUpdate={onUpdate}
        onDeleteAll={vi.fn()}
      />,
    );
    const gridInput = screen.getByLabelText('Grid px');
    await userEvent.type(gridInput, '128');
    await userEvent.keyboard('{Enter}');
    // scale = 64/128 = 0.5 → 1024*0.5 = 512
    expect(onUpdate).toHaveBeenCalledWith('p-1', { width: 512, height: 512 });
  });

  it('does not call onUpdate for grid cell size when value is 0', async () => {
    const onUpdate = vi.fn();
    const placement = makePlacement({ assetId: 'asset-1' });
    render(
      <TileInspector
        selectedPlacements={[placement]}
        assets={makeAssetsMap([makeAsset()])}
        canvasGridSize={64}
        onUpdate={onUpdate}
        onDeleteAll={vi.fn()}
      />,
    );
    const gridInput = screen.getByLabelText('Grid px');
    await userEvent.type(gridInput, '0');
    await userEvent.keyboard('{Enter}');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('calls onDeleteAll with the single placement id when delete is clicked', async () => {
    const onDeleteAll = vi.fn();
    const placement = makePlacement();
    render(
      <TileInspector
        selectedPlacements={[placement]}
        assets={makeAssetsMap([makeAsset()])}
        canvasGridSize={64}
        onUpdate={vi.fn()}
        onDeleteAll={onDeleteAll}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete tile/i }));
    expect(onDeleteAll).toHaveBeenCalledWith(new Set(['p-1']));
  });

  it('shows batch heading when multiple tiles selected', () => {
    const p1 = makePlacement({ id: 'p-1' });
    const p2 = makePlacement({ id: 'p-2' });
    render(
      <TileInspector
        selectedPlacements={[p1, p2]}
        assets={makeAssetsMap([makeAsset()])}
        canvasGridSize={64}
        onUpdate={vi.fn()}
        onDeleteAll={vi.fn()}
      />,
    );
    expect(screen.getByText('2 tiles selected')).toBeInTheDocument();
  });

  it('calls onDeleteAll with all selected ids in batch mode', async () => {
    const onDeleteAll = vi.fn();
    const p1 = makePlacement({ id: 'p-1' });
    const p2 = makePlacement({ id: 'p-2' });
    render(
      <TileInspector
        selectedPlacements={[p1, p2]}
        assets={makeAssetsMap([makeAsset()])}
        canvasGridSize={64}
        onUpdate={vi.fn()}
        onDeleteAll={onDeleteAll}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete 2 tiles/i }));
    expect(onDeleteAll).toHaveBeenCalledWith(new Set(['p-1', 'p-2']));
  });

  it('applies batch rotation delta to all placements', async () => {
    const onUpdate = vi.fn();
    const p1 = makePlacement({ id: 'p-1', rotation: 45 });
    const p2 = makePlacement({ id: 'p-2', rotation: 90 });
    render(
      <TileInspector
        selectedPlacements={[p1, p2]}
        assets={makeAssetsMap([makeAsset()])}
        canvasGridSize={64}
        onUpdate={onUpdate}
        onDeleteAll={vi.fn()}
      />,
    );
    const rotInput = screen.getByLabelText('Rotate (°)');
    await userEvent.type(rotInput, '90');
    await userEvent.keyboard('{Enter}');
    expect(onUpdate).toHaveBeenCalledWith('p-1', { rotation: 135 });
    expect(onUpdate).toHaveBeenCalledWith('p-2', { rotation: 180 });
  });

  it('does not call onUpdate when a numeric field is cleared and committed', async () => {
    const onUpdate = vi.fn();
    const placement = makePlacement({ x: 128 });
    render(
      <TileInspector
        selectedPlacements={[placement]}
        assets={makeAssetsMap([makeAsset()])}
        canvasGridSize={64}
        onUpdate={onUpdate}
        onDeleteAll={vi.fn()}
      />,
    );
    const xInput = screen.getByLabelText('X');
    await userEvent.clear(xInput);
    await userEvent.keyboard('{Enter}');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does not call onUpdate for batch rotation when field is empty', async () => {
    const onUpdate = vi.fn();
    const p1 = makePlacement({ id: 'p-1', rotation: 45 });
    const p2 = makePlacement({ id: 'p-2', rotation: 90 });
    render(
      <TileInspector
        selectedPlacements={[p1, p2]}
        assets={makeAssetsMap([makeAsset()])}
        canvasGridSize={64}
        onUpdate={onUpdate}
        onDeleteAll={vi.fn()}
      />,
    );
    const rotInput = screen.getByLabelText('Rotate (°)');
    await userEvent.keyboard('{Enter}');
    expect(onUpdate).not.toHaveBeenCalled();
    // Confirm it still works when a real value is entered
    await userEvent.type(rotInput, '90');
    await userEvent.keyboard('{Enter}');
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });
});
