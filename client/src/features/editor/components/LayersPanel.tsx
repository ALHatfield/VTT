// LayersPanel — Phase 5C
// Photoshop-style layer sidebar. Lists tile placements grouped by category tab,
// with visibility / lock toggles, drag-to-reorder (z-index), and a TileInspector.
import type { DragEvent, ReactElement } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { AssetCategory, TileAsset, TilePlacement } from '@vtt/shared';

import styles from './LayersPanel.module.css';
import type { TileUpdatePayload } from './TileInspector';
import { TileInspector } from './TileInspector';

type LayerTab = AssetCategory;

const TABS: { id: LayerTab; label: string }[] = [
  { id: 'background', label: 'BG' },
  { id: 'playground', label: 'Play' },
  { id: 'foreground', label: 'FG' },
];

interface LayersPanelProps {
  placements: TilePlacement[];
  selectedTilePlacementIds: ReadonlySet<string>;
  hiddenTileIds: ReadonlySet<string>;
  lockedTileIds: ReadonlySet<string>;
  assets: Map<string, TileAsset>;
  canvasGridSize: number;
  onSelectTile: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDeleteTile: (id: string) => void;
  onReorderTile: (draggedId: string, targetId: string) => void;
  onUpdateTile: (id: string, payload: TileUpdatePayload) => void;
  onDeleteSelectedTiles: (ids: ReadonlySet<string>) => void;
  onAlignToGrid?: (placementId: string) => void;
}

export function LayersPanel({
  placements,
  selectedTilePlacementIds,
  hiddenTileIds,
  lockedTileIds,
  assets,
  canvasGridSize,
  onSelectTile,
  onToggleVisibility,
  onToggleLock,
  onDeleteTile,
  onReorderTile,
  onUpdateTile,
  onDeleteSelectedTiles,
  onAlignToGrid,
}: LayersPanelProps): ReactElement {
  const [activeTab, setActiveTab] = useState<LayerTab>('background');

  // Tile rows for the active tab, sorted by z-index descending (top = highest)
  const tabPlacements = useMemo(
    () => placements.filter((p) => p.category === activeTab).sort((a, b) => b.zIndex - a.zIndex),
    [placements, activeTab],
  );

  // Inspector: collect selected placements (any category)
  const selectedPlacements = useMemo(
    () => placements.filter((p) => selectedTilePlacementIds.has(p.id)),
    [placements, selectedTilePlacementIds],
  );

  // Drag-to-reorder state
  const draggedId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: DragEvent<HTMLLIElement>, id: string) => {
    draggedId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id); // required by Firefox
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLLIElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLIElement>, targetId: string) => {
      e.preventDefault();
      const srcId = draggedId.current;
      if (srcId && srcId !== targetId) {
        onReorderTile(srcId, targetId);
      }
      draggedId.current = null;
      setDragOverId(null);
    },
    [onReorderTile],
  );

  const handleDragEnd = useCallback(() => {
    draggedId.current = null;
    setDragOverId(null);
  }, []);

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Layers</h2>
        <div className={styles.tabs} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        {tabPlacements.length === 0 ? (
          <p className={styles.placeholder}>No tiles in this layer.</p>
        ) : (
          <ul className={styles.list} role="listbox">
            {tabPlacements.map((p) => {
              const asset = assets.get(p.assetId);
              const isSelected = selectedTilePlacementIds.has(p.id);
              const isHidden = hiddenTileIds.has(p.id);
              const isLocked = lockedTileIds.has(p.id);
              const isDragTarget = dragOverId === p.id;

              return (
                <li
                  key={p.id}
                  draggable
                  role="option"
                  tabIndex={0}
                  aria-selected={isSelected}
                  className={`${styles.row} ${isSelected ? styles.rowSelected : ''} ${isDragTarget ? styles.rowDragOver : ''}`}
                  onDragStart={(e) => handleDragStart(e, p.id)}
                  onDragOver={(e) => handleDragOver(e, p.id)}
                  onDrop={(e) => handleDrop(e, p.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectTile(p.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectTile(p.id)}
                >
                  <span className={styles.dragHandle} aria-hidden="true">
                    ⠿
                  </span>
                  {asset ? (
                    <img
                      src={asset.thumbnailUrl}
                      alt={asset.filename}
                      className={styles.thumbnail}
                      draggable={false}
                    />
                  ) : (
                    <span className={styles.thumbnailPlaceholder} />
                  )}
                  <span className={styles.name} title={asset?.filename ?? p.id}>
                    {asset?.filename ?? p.id.slice(0, 8)}
                  </span>
                  <button
                    type="button"
                    title={isHidden ? 'Show tile' : 'Hide tile'}
                    aria-label={isHidden ? 'Show tile' : 'Hide tile'}
                    className={`${styles.iconBtn} ${isHidden ? styles.iconBtnOff : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(p.id);
                    }}
                  >
                    {isHidden ? '🚫' : '👁'}
                  </button>
                  <button
                    type="button"
                    title={isLocked ? 'Unlock tile' : 'Lock tile'}
                    aria-label={isLocked ? 'Unlock tile' : 'Lock tile'}
                    className={`${styles.iconBtn} ${isLocked ? styles.iconBtnLocked : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(p.id);
                    }}
                  >
                    {isLocked ? '🔒' : '🔓'}
                  </button>
                  <button
                    type="button"
                    title="Delete tile"
                    aria-label="Delete tile"
                    className={`${styles.iconBtn} ${styles.iconBtnDelete}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTile(p.id);
                    }}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <TileInspector
        selectedPlacements={selectedPlacements}
        assets={assets}
        canvasGridSize={canvasGridSize}
        onUpdate={onUpdateTile}
        onDeleteAll={onDeleteSelectedTiles}
        onAlignToGrid={onAlignToGrid}
      />
    </aside>
  );
}
