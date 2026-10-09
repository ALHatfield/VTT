// WallsSection — Phase 5F
// Walls tab of the LayersPanel: tool toggle, visibility, bulk delete, list, inspector.
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { WallSegment, WallSegmentUpdatePayload } from '@vtt/shared';

import { WallInspector } from './WallInspector';
import styles from './WallsSection.module.css';
import { WALL_TOOL_HINT_ID } from './WallToolOverlay';

export interface WallsSectionProps {
  walls: readonly WallSegment[];
  selectedWallId: string | null;
  wallsVisible: boolean;
  isToolActive: boolean;
  /** Off by default — walls are drawn freely unless grid snapping is enabled. */
  snapToGrid: boolean;
  error: string | null;
  onToggleTool: () => void;
  /** Called when the walls tab is left so the tool stops capturing canvas input. */
  onDeactivateTool: () => void;
  onToggleSnap: () => void;
  onToggleVisibility: () => void;
  onSelectWall: (wallId: string) => void;
  onDeleteWall: (wallId: string) => void;
  onDeleteAll: () => void;
  onUpdateWall: (wallId: string, payload: WallSegmentUpdatePayload) => void;
}

type WallKind = 'door' | 'window' | 'passable' | 'wall';

function wallKind(wall: WallSegment): WallKind {
  if (wall.isDoor) return 'door';
  if (!wall.blocksLight) return 'window';
  if (!wall.blocksMovement) return 'passable';
  return 'wall';
}

const KIND_LABEL: Record<WallKind, string> = {
  door: 'Door',
  window: 'Window',
  passable: 'Passable',
  wall: 'Wall',
};

const KIND_SWATCH: Record<WallKind, string> = {
  door: styles.swatchDoor,
  window: styles.swatchWindow,
  passable: styles.swatchPassable,
  wall: styles.swatchWall,
};

export function WallsSection({
  walls,
  selectedWallId,
  wallsVisible,
  isToolActive,
  snapToGrid,
  error,
  onToggleTool,
  onToggleSnap,
  onToggleVisibility,
  onSelectWall,
  onDeleteWall,
  onDeleteAll,
  onUpdateWall,
}: WallsSectionProps): ReactElement {
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const selectedWall = walls.find((w) => w.id === selectedWallId) ?? null;

  useEffect(() => {
    if (walls.length === 0) setConfirmingDeleteAll(false);
  }, [walls.length]);

  return (
    <>
      <div className={styles.body}>
        <div className={styles.controls}>
          <button
            type="button"
            aria-pressed={isToolActive}
            className={`${styles.toolBtn} ${isToolActive ? styles.toolBtnActive : ''}`}
            onClick={onToggleTool}
          >
            {isToolActive ? 'Drawing walls' : 'Draw walls'}
          </button>
          <button
            type="button"
            title="Show walls"
            aria-label="Show walls"
            aria-pressed={wallsVisible}
            className={`${styles.iconBtn} ${wallsVisible ? '' : styles.iconBtnOff}`}
            onClick={onToggleVisibility}
          >
            {wallsVisible ? '👁' : '🚫'}
          </button>
        </div>

        <label className={styles.snapToggle}>
          <input type="checkbox" checked={snapToGrid} onChange={onToggleSnap} />
          Snap to grid
        </label>

        {isToolActive && (
          <p id={WALL_TOOL_HINT_ID} className={styles.hint}>
            Click to place vertices · Double-click or Esc to finish · Points join nearby wall ends ·
            Shift+click to start on an existing wall · Hold Alt to{' '}
            {snapToGrid ? 'draw freely' : 'snap to grid'} · Del removes the selected wall
          </p>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {walls.length === 0 ? (
          <p className={styles.placeholder}>No walls on this scene.</p>
        ) : (
          <ul className={styles.list} aria-label="Walls">
            {walls.map((wall, index) => {
              const kind = wallKind(wall);
              const isSelected = wall.id === selectedWallId;
              const doorState = kind === 'door' ? (wall.isOpen ? ' (open)' : ' (closed)') : '';
              return (
                <li
                  key={wall.id}
                  className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className={styles.selectBtn}
                    onClick={() => onSelectWall(wall.id)}
                  >
                    <span className={`${styles.swatch} ${KIND_SWATCH[kind]}`} aria-hidden="true" />
                    <span className={styles.name}>
                      {KIND_LABEL[kind]} {index + 1}
                      {doorState}
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Delete wall"
                    aria-label={`Delete ${KIND_LABEL[kind]} ${index + 1}`}
                    className={`${styles.iconBtn} ${styles.iconBtnDelete}`}
                    onClick={() => onDeleteWall(wall.id)}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {walls.length > 0 && (
          <div className={styles.footer}>
            {confirmingDeleteAll ? (
              <>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setConfirmingDeleteAll(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.deleteAllBtn}
                  onClick={() => {
                    setConfirmingDeleteAll(false);
                    onDeleteAll();
                  }}
                >
                  Confirm delete {walls.length}
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.deleteAllBtn}
                onClick={() => setConfirmingDeleteAll(true)}
              >
                Delete all walls
              </button>
            )}
          </div>
        )}
      </div>

      <WallInspector wall={selectedWall} onUpdate={onUpdateWall} onDelete={onDeleteWall} />
    </>
  );
}
