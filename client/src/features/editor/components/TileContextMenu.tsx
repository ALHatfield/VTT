// TileContextMenu — Phase 5B
// Floating right-click context menu for a selected tile placement.
// Rotate, delete, and duplicate actions.
import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';

import styles from './TileContextMenu.module.css';

interface TileContextMenuProps {
  /** Screen X position of the context menu anchor (cursor position). */
  screenX: number;
  /** Screen Y position of the context menu anchor (cursor position). */
  screenY: number;
  onRotate: (degrees: 90 | 180 | 270) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

export function TileContextMenu({
  screenX,
  screenY,
  onRotate,
  onDelete,
  onDuplicate,
  onClose,
}: TileContextMenuProps): ReactElement {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return (): void => window.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div ref={menuRef} className={styles.menu} style={{ left: screenX, top: screenY }} role="menu">
      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          onRotate(90);
          onClose();
        }}
      >
        Rotate 90°
      </button>
      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          onRotate(180);
          onClose();
        }}
      >
        Rotate 180°
      </button>
      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          onRotate(270);
          onClose();
        }}
      >
        Rotate 270°
      </button>
      <hr className={styles.divider} />
      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          onDuplicate();
          onClose();
        }}
      >
        Duplicate
      </button>
      <hr className={styles.divider} />
      <button
        type="button"
        className={`${styles.item} ${styles.danger}`}
        role="menuitem"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        Delete
      </button>
    </div>
  );
}
