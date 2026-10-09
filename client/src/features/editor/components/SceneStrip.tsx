// SceneStrip — Phase 5H
// Full-width horizontal scene library rendered between the campaign toolbar and
// the editor body. DM-only: thumbnail cards, active badge, create button,
// inline rename, context menu (duplicate / delete), and drag-to-reorder.
import type { DragEvent, KeyboardEvent, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { SceneSummary } from '@vtt/shared';

import type { SaveStatus } from '../utils/save-tracker';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import styles from './SceneStrip.module.css';

export interface SceneStripProps {
  scenes: readonly SceneSummary[];
  editedSceneId: string | null;
  isLoading: boolean;
  error: string | null;
  saveStatus: SaveStatus;
  onRetrySave: () => void;
  onSelectScene: (sceneId: string) => void;
  onCreateScene: () => void;
  onRenameScene: (sceneId: string, name: string) => void;
  onDuplicateScene: (sceneId: string) => void;
  onDeleteScene: (sceneId: string) => void;
  onReorderScenes: (sceneIds: string[]) => void;
}

interface MenuState {
  sceneId: string;
  /** Fixed-position anchor — escapes the scroll container's overflow clipping. */
  screenX: number;
  screenY: number;
  confirmingDelete: boolean;
}

/** Keep the fixed menu inside the viewport's right edge. */
const MENU_WIDTH_PX = 150;

function clampMenuX(x: number): number {
  return Math.max(0, Math.min(x, window.innerWidth - MENU_WIDTH_PX));
}

export function SceneStrip({
  scenes,
  editedSceneId,
  isLoading,
  error,
  saveStatus,
  onRetrySave,
  onSelectScene,
  onCreateScene,
  onRenameScene,
  onDuplicateScene,
  onDeleteScene,
  onReorderScenes,
}: SceneStripProps): ReactElement {
  const [renamingSceneId, setRenamingSceneId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the context menu on any outside click or Escape
  useEffect(() => {
    if (!menu) return;
    const handleMouse = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const handleKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', handleMouse);
    document.addEventListener('keydown', handleKey);
    return (): void => {
      document.removeEventListener('mousedown', handleMouse);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menu]);

  const startRename = (scene: SceneSummary): void => {
    setMenu(null);
    setRenamingSceneId(scene.id);
    setRenameValue(scene.name);
  };

  const commitRename = (): void => {
    if (renamingSceneId) {
      const trimmed = renameValue.trim();
      const current = scenes.find((s) => s.id === renamingSceneId);
      if (trimmed && current && trimmed !== current.name) {
        onRenameScene(renamingSceneId, trimmed);
      }
    }
    setRenamingSceneId(null);
  };

  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setRenamingSceneId(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetSceneId: string): void => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggedSceneId;
    setDraggedSceneId(null);
    if (!sourceId || sourceId === targetSceneId) return;
    const order = scenes.map((s) => s.id).filter((id) => id !== sourceId);
    const insertAt = order.indexOf(targetSceneId);
    order.splice(insertAt >= 0 ? insertAt : order.length, 0, sourceId);
    onReorderScenes(order);
  };

  // Dropping on empty strip space (not a card) moves the dragged scene to the end
  const handleDropAtEnd = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const sourceId = draggedSceneId;
    setDraggedSceneId(null);
    if (!sourceId) return;
    const order = scenes.map((s) => s.id).filter((id) => id !== sourceId);
    order.push(sourceId);
    onReorderScenes(order);
  };

  const canDelete = (scene: SceneSummary): boolean => !scene.isActive && scenes.length > 1;

  return (
    <div className={styles.strip} role="toolbar" aria-label="Scene library">
      <div
        className={styles.cards}
        onDragOver={(e) => {
          if (draggedSceneId) e.preventDefault();
        }}
        onDrop={handleDropAtEnd}
      >
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className={`${styles.card} ${scene.id === editedSceneId ? styles.cardSelected : ''} ${
              scene.id === draggedSceneId ? styles.cardDragging : ''
            }`}
            draggable={renamingSceneId !== scene.id}
            onDragStart={() => setDraggedSceneId(scene.id)}
            onDragEnd={() => setDraggedSceneId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, scene.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({
                sceneId: scene.id,
                screenX: clampMenuX(e.clientX),
                screenY: e.clientY,
                confirmingDelete: false,
              });
            }}
          >
            <button
              type="button"
              className={styles.thumbBtn}
              title={`Edit ${scene.name}`}
              onClick={() => onSelectScene(scene.id)}
            >
              {scene.thumbnailUrl ? (
                <img className={styles.thumb} src={scene.thumbnailUrl} alt="" draggable={false} />
              ) : (
                <span className={styles.thumbPlaceholder} aria-hidden="true">
                  ▦
                </span>
              )}
              {scene.isActive && <span className={styles.activeBadge}>Active</span>}
            </button>
            <div className={styles.cardFooter}>
              {renamingSceneId === scene.id ? (
                <input
                  className={styles.renameInput}
                  value={renameValue}
                  autoFocus
                  aria-label="Scene name"
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleRenameKeyDown}
                />
              ) : (
                <button
                  type="button"
                  className={styles.nameBtn}
                  title="Double-click to rename"
                  onClick={() => onSelectScene(scene.id)}
                  onDoubleClick={() => startRename(scene)}
                >
                  {scene.name}
                </button>
              )}
              <button
                type="button"
                className={styles.menuBtn}
                aria-label={`Scene options for ${scene.name}`}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenu({
                    sceneId: scene.id,
                    screenX: clampMenuX(rect.left),
                    screenY: rect.bottom + 2,
                    confirmingDelete: false,
                  });
                }}
              >
                ⋯
              </button>
            </div>
            {menu?.sceneId === scene.id && (
              <div
                ref={menuRef}
                className={styles.menu}
                style={{ left: menu.screenX, top: menu.screenY }}
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => {
                    setMenu(null);
                    startRename(scene);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => {
                    setMenu(null);
                    onDuplicateScene(scene.id);
                  }}
                >
                  Duplicate
                </button>
                {menu.confirmingDelete ? (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={() => {
                      setMenu(null);
                      onDeleteScene(scene.id);
                    }}
                  >
                    Confirm delete
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    disabled={!canDelete(scene)}
                    title={
                      canDelete(scene)
                        ? undefined
                        : scene.isActive
                          ? 'The active scene cannot be deleted'
                          : 'A campaign must keep at least one scene'
                    }
                    onClick={() => setMenu({ ...menu, confirmingDelete: true })}
                  >
                    Delete…
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <button type="button" className={styles.createBtn} onClick={onCreateScene}>
          + New scene
        </button>
      </div>
      <div className={styles.trailing}>
        {isLoading && <span className={styles.loading}>Loading…</span>}
        {error && (
          <span className={styles.error} role="alert">
            {error}
          </span>
        )}
        <SaveStatusIndicator status={saveStatus} onRetry={onRetrySave} />
      </div>
    </div>
  );
}
