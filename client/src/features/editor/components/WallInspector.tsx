// WallInspector — Phase 5F
// Properties for the selected wall segment: blocking flags and door state.
import type { ReactElement } from 'react';

import type { WallSegment, WallSegmentUpdatePayload } from '@vtt/shared';

import styles from './WallInspector.module.css';

interface WallInspectorProps {
  wall: WallSegment | null;
  onUpdate: (wallId: string, payload: WallSegmentUpdatePayload) => void;
  onDelete: (wallId: string) => void;
}

function formatPoint(x: number, y: number): string {
  return `(${Math.round(x)}, ${Math.round(y)})`;
}

export function WallInspector({ wall, onUpdate, onDelete }: WallInspectorProps): ReactElement {
  if (!wall) {
    return (
      <div className={styles.inspector}>
        <p className={styles.empty}>Select a wall to edit its properties.</p>
      </div>
    );
  }

  return (
    <section className={styles.inspector} aria-label="Wall inspector">
      <h3 className={styles.heading}>{wall.isDoor ? 'Door' : 'Wall'}</h3>
      <p className={styles.endpoints}>
        {formatPoint(wall.x1, wall.y1)} → {formatPoint(wall.x2, wall.y2)}
      </p>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={wall.blocksLight}
          onChange={(e) => onUpdate(wall.id, { blocksLight: e.target.checked })}
        />
        Blocks light
      </label>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={wall.blocksMovement}
          onChange={(e) => onUpdate(wall.id, { blocksMovement: e.target.checked })}
        />
        Blocks movement
      </label>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={wall.isDoor}
          onChange={(e) =>
            onUpdate(
              wall.id,
              e.target.checked ? { isDoor: true } : { isDoor: false, isOpen: false },
            )
          }
        />
        Door
      </label>

      {wall.isDoor && (
        <div className={styles.doorState} role="group" aria-label="Door state">
          <button
            type="button"
            aria-pressed={!wall.isOpen}
            className={`${styles.stateBtn} ${!wall.isOpen ? styles.stateBtnActive : ''}`}
            onClick={() => onUpdate(wall.id, { isOpen: false })}
          >
            Closed
          </button>
          <button
            type="button"
            aria-pressed={wall.isOpen}
            className={`${styles.stateBtn} ${wall.isOpen ? styles.stateBtnActive : ''}`}
            onClick={() => onUpdate(wall.id, { isOpen: true })}
          >
            Open
          </button>
        </div>
      )}

      <button type="button" className={styles.deleteBtn} onClick={() => onDelete(wall.id)}>
        Delete wall
      </button>
    </section>
  );
}
