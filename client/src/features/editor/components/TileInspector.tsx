// TileInspector — Phase 5C
// Properties panel for selected tile placements. Shows editable fields for a
// single selection and batch operations for multiple selections.
import type { ChangeEvent, ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';

import type { TileAsset, TilePlacement } from '@vtt/shared';

import styles from './TileInspector.module.css';

export interface TileUpdatePayload {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
}

interface TileInspectorProps {
  selectedPlacements: TilePlacement[];
  assets: Map<string, TileAsset>;
  /** Canvas grid cell size (px) — used to auto-calculate scale from asset grid size. */
  canvasGridSize: number;
  onUpdate: (placementId: string, payload: TileUpdatePayload) => void;
  onDeleteAll: (ids: ReadonlySet<string>) => void;
  onAlignToGrid?: (placementId: string) => void;
}

/** Calculate new dimensions from a grid cell size input. */
export function calcScaledDimensions(
  assetWidth: number,
  assetHeight: number,
  canvasGridSize: number,
  assetGridSize: number,
): { width: number; height: number } {
  if (assetGridSize <= 0) return { width: assetWidth, height: assetHeight };
  const scale = canvasGridSize / assetGridSize;
  return {
    width: Math.round(assetWidth * scale),
    height: Math.round(assetHeight * scale),
  };
}

export function TileInspector({
  selectedPlacements,
  assets,
  canvasGridSize,
  onUpdate,
  onDeleteAll,
  onAlignToGrid,
}: TileInspectorProps): ReactElement {
  const count = selectedPlacements.length;

  // -------------------------------------------------------------------------
  // Single-selection fields — controlled inputs seeded from the placement
  // -------------------------------------------------------------------------

  const single = count === 1 ? selectedPlacements[0] : null;

  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [rotation, setRotation] = useState('');
  const [zIndex, setZIndex] = useState('');
  const [gridCellSize, setGridCellSize] = useState('');

  // Seed fields whenever the selected placement changes
  useEffect(() => {
    if (!single) {
      setX('');
      setY('');
      setWidth('');
      setHeight('');
      setRotation('');
      setZIndex('');
      setGridCellSize('');
      return;
    }
    setX(String(Math.round(single.x)));
    setY(String(Math.round(single.y)));
    setWidth(String(Math.round(single.width)));
    setHeight(String(Math.round(single.height)));
    setRotation(String(single.rotation));
    setZIndex(String(single.zIndex));
    setGridCellSize('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single?.id]); // intentional: only re-seed when selected placement changes by identity, not on every property update

  const commitNumber = useCallback(
    (field: keyof TileUpdatePayload, raw: string): void => {
      if (!single) return;
      if (raw.trim() === '') return;
      const value = Number(raw);
      if (!Number.isFinite(value)) return;
      onUpdate(single.id, { [field]: value });
    },
    [single, onUpdate],
  );

  const handleGridCellSizeCommit = useCallback((): void => {
    if (!single) return;
    const assetGridSize = Number(gridCellSize);
    if (!Number.isFinite(assetGridSize) || assetGridSize <= 0) return;
    const asset = assets.get(single.assetId);
    if (!asset) return;
    const { width: newW, height: newH } = calcScaledDimensions(
      asset.width,
      asset.height,
      canvasGridSize,
      assetGridSize,
    );
    setWidth(String(newW));
    setHeight(String(newH));
    onUpdate(single.id, { width: newW, height: newH });
  }, [single, gridCellSize, assets, canvasGridSize, onUpdate]);

  // -------------------------------------------------------------------------
  // Batch — rotation delta applied to all selected tiles
  // -------------------------------------------------------------------------

  const [batchRotation, setBatchRotation] = useState('');

  const handleBatchRotateCommit = useCallback((): void => {
    if (batchRotation.trim() === '') return;
    const delta = Number(batchRotation);
    if (!Number.isFinite(delta)) return;
    for (const p of selectedPlacements) {
      const newRotation = (((p.rotation + delta) % 360) + 360) % 360;
      onUpdate(p.id, { rotation: newRotation });
    }
    setBatchRotation('');
  }, [batchRotation, selectedPlacements, onUpdate]);

  const handleDeleteAll = useCallback((): void => {
    const ids = new Set(selectedPlacements.map((p) => p.id));
    onDeleteAll(ids);
  }, [selectedPlacements, onDeleteAll]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (count === 0) {
    return (
      <div className={styles.inspector}>
        <p className={styles.empty}>Select a tile to inspect</p>
      </div>
    );
  }

  if (count > 1) {
    return (
      <div className={styles.inspector}>
        <p className={styles.batchHeading}>{count} tiles selected</p>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="batch-rotation">
            Rotate (°)
          </label>
          <input
            id="batch-rotation"
            type="number"
            className={styles.input}
            value={batchRotation}
            placeholder="delta"
            onChange={(e: ChangeEvent<HTMLInputElement>) => setBatchRotation(e.target.value)}
            onBlur={handleBatchRotateCommit}
            onKeyDown={(e) => e.key === 'Enter' && handleBatchRotateCommit()}
          />
        </div>
        <button type="button" className={styles.deleteBtn} onClick={handleDeleteAll}>
          Delete {count} tiles
        </button>
      </div>
    );
  }

  return (
    <div className={styles.inspector}>
      <div className={styles.grid2}>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="tile-x">
            X
          </label>
          <input
            id="tile-x"
            type="number"
            className={styles.input}
            value={x}
            onChange={(e) => setX(e.target.value)}
            onBlur={() => commitNumber('x', x)}
            onKeyDown={(e) => e.key === 'Enter' && commitNumber('x', x)}
          />
        </div>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="tile-y">
            Y
          </label>
          <input
            id="tile-y"
            type="number"
            className={styles.input}
            value={y}
            onChange={(e) => setY(e.target.value)}
            onBlur={() => commitNumber('y', y)}
            onKeyDown={(e) => e.key === 'Enter' && commitNumber('y', y)}
          />
        </div>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="tile-w">
            W
          </label>
          <input
            id="tile-w"
            type="number"
            className={styles.input}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            onBlur={() => commitNumber('width', width)}
            onKeyDown={(e) => e.key === 'Enter' && commitNumber('width', width)}
          />
        </div>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="tile-h">
            H
          </label>
          <input
            id="tile-h"
            type="number"
            className={styles.input}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onBlur={() => commitNumber('height', height)}
            onKeyDown={(e) => e.key === 'Enter' && commitNumber('height', height)}
          />
        </div>
      </div>
      <div className={styles.row}>
        <label className={styles.label} htmlFor="tile-rotation">
          Rot
        </label>
        <input
          id="tile-rotation"
          type="number"
          className={styles.input}
          value={rotation}
          onChange={(e) => setRotation(e.target.value)}
          onBlur={() => commitNumber('rotation', rotation)}
          onKeyDown={(e) => e.key === 'Enter' && commitNumber('rotation', rotation)}
        />
      </div>
      <div className={styles.row}>
        <label className={styles.label} htmlFor="tile-zindex">
          Z
        </label>
        <input
          id="tile-zindex"
          type="number"
          className={styles.input}
          value={zIndex}
          onChange={(e) => setZIndex(e.target.value)}
          onBlur={() => commitNumber('zIndex', zIndex)}
          onKeyDown={(e) => e.key === 'Enter' && commitNumber('zIndex', zIndex)}
        />
      </div>
      <div className={styles.divider} />
      <div className={styles.row}>
        <label className={styles.label} htmlFor="tile-grid-cell">
          Grid px
        </label>
        <input
          id="tile-grid-cell"
          type="number"
          className={styles.input}
          value={gridCellSize}
          placeholder={`canvas: ${canvasGridSize}`}
          onChange={(e) => setGridCellSize(e.target.value)}
          onBlur={handleGridCellSizeCommit}
          onKeyDown={(e) => e.key === 'Enter' && handleGridCellSizeCommit()}
        />
      </div>
      {onAlignToGrid && single && (
        <button type="button" className={styles.alignBtn} onClick={() => onAlignToGrid(single.id)}>
          Align to Grid
        </button>
      )}
      <button type="button" className={styles.deleteBtn} onClick={handleDeleteAll}>
        Delete tile
      </button>
    </div>
  );
}
