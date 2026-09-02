import type { DragEvent, ReactElement } from 'react';

import type { CampaignRole, NpcSubtype } from '@vtt/shared';
import {
  DRAW_DEFAULT_COLOR,
  DRAW_DEFAULT_WIDTH,
  DRAW_WIDTH_MAX,
  DRAW_WIDTH_MIN,
} from '@vtt/shared';

import { NPC_DRAG_MIME } from '../hooks/useNpcDrop';

import type { FogViewMode } from '../hooks/useFogViewMode';
import type { ToolMode } from '../hooks/useToolMode';
import styles from './CanvasToolbar.module.css';

interface ToolDef {
  id: ToolMode;
  label: string;
  icon: string;
  title: string;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', icon: '◈', title: 'Select tool — click and drag tokens' },
  { id: 'pan', label: 'Pan', icon: '✥', title: 'Pan tool — left-click drag to pan the map' },
  {
    id: 'measure',
    label: 'Measure',
    icon: '⇿',
    title: 'Measure tool — click and drag to measure distance',
  },
];

// DM-only panel tools ('npc-place', 'fog-reveal', 'fog-hide') are gated inline
// with role checks and are not enumerated here.
function visibleTools(role: CampaignRole | null): ToolMode[] {
  if (role === 'observer') return ['pan'];
  return ['select', 'pan', 'measure'];
}

export type DrawShapeKind = 'freehand' | 'rect' | 'circle';

interface CanvasToolbarProps {
  activeTool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  role: CampaignRole | null;
  /** Whether the active measurement is private (Phase 4J). Only relevant when activeTool === 'measure'. */
  measurePrivate?: boolean;
  onMeasurePrivateChange?: (isPrivate: boolean) => void;
  /** Current fog view mode — DM's own view or player preview. DM-only. */
  fogViewMode?: FogViewMode;
  onFogViewModeChange?: (mode: FogViewMode) => void;
  /** Drawing tool state (Phase 4K). */
  drawShapeKind?: DrawShapeKind;
  onDrawShapeKindChange?: (kind: DrawShapeKind) => void;
  drawStrokeColor?: string;
  onDrawStrokeColorChange?: (color: string) => void;
  drawStrokeWidth?: number;
  onDrawStrokeWidthChange?: (width: number) => void;
  onDrawClear?: () => void;
}

export function CanvasToolbar({
  activeTool,
  onToolChange,
  role,
  measurePrivate = false,
  onMeasurePrivateChange,
  fogViewMode = 'dm',
  onFogViewModeChange,
  drawShapeKind = 'freehand',
  onDrawShapeKindChange,
  drawStrokeColor = DRAW_DEFAULT_COLOR,
  onDrawStrokeColorChange,
  drawStrokeWidth = DRAW_DEFAULT_WIDTH,
  onDrawStrokeWidthChange,
  onDrawClear,
}: CanvasToolbarProps): ReactElement {
  const allowed = visibleTools(role);
  const isFogActive = activeTool === 'fog-reveal' || activeTool === 'fog-hide';
  const isDrawActive = activeTool === 'draw-freehand' || activeTool === 'draw-shape';

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Canvas tools">
      {TOOLS.filter((t) => allowed.includes(t.id)).map((tool) => (
        <div key={tool.id} className={styles.toolGroup}>
          <button
            type="button"
            className={`${styles.toolBtn} ${activeTool === tool.id ? styles.active : ''}`}
            title={tool.title}
            aria-pressed={activeTool === tool.id}
            onClick={() => onToolChange(tool.id)}
          >
            <span className={styles.icon}>{tool.icon}</span>
            <span className={styles.label}>{tool.label}</span>
          </button>
          {tool.id === 'measure' && activeTool === 'measure' && onMeasurePrivateChange && (
            <div className={`${styles.toolPanel} ${styles.measurePanel}`}>
              <label className={styles.measureToggle}>
                <input
                  type="checkbox"
                  checked={measurePrivate}
                  onChange={(e) => onMeasurePrivateChange(e.target.checked)}
                />
                <span>Private</span>
              </label>
            </div>
          )}
        </div>
      ))}
      {/* Draw tool — DM and Player (not observer) */}
      {role !== 'observer' && role !== null && (
        <div className={styles.toolGroup}>
          <button
            type="button"
            className={`${styles.toolBtn} ${isDrawActive ? styles.active : ''}`}
            title="Draw tool — freehand or shape annotations"
            aria-pressed={isDrawActive}
            onClick={() => {
              if (isDrawActive) {
                onToolChange('select');
              } else {
                onToolChange(drawShapeKind === 'freehand' ? 'draw-freehand' : 'draw-shape');
              }
            }}
          >
            <span className={styles.icon}>✏️</span>
            <span className={styles.label}>Draw</span>
          </button>
          {isDrawActive && (
            <div className={`${styles.toolPanel} ${styles.drawPanel}`}>
              <div className={styles.drawSubMode}>
                {(['freehand', 'rect', 'circle'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`${styles.drawModeBtn} ${drawShapeKind === kind ? styles.drawModeBtnActive : ''}`}
                    title={
                      kind === 'freehand' ? 'Freehand' : kind === 'rect' ? 'Rectangle' : 'Circle'
                    }
                    onClick={() => {
                      onDrawShapeKindChange?.(kind);
                      onToolChange(kind === 'freehand' ? 'draw-freehand' : 'draw-shape');
                    }}
                  >
                    {kind === 'freehand' ? 'Free' : kind === 'rect' ? 'Rect' : 'Circ'}
                  </button>
                ))}
              </div>
              <label className={styles.drawColorLabel}>
                <span className={styles.drawLabelText}>Color</span>
                <input
                  type="color"
                  className={styles.drawColorInput}
                  value={drawStrokeColor}
                  onChange={(e) => onDrawStrokeColorChange?.(e.target.value)}
                />
              </label>
              <label className={styles.drawWidthLabel}>
                <span className={styles.drawLabelText}>Width {drawStrokeWidth}px</span>
                <input
                  type="range"
                  className={styles.drawWidthInput}
                  min={DRAW_WIDTH_MIN}
                  max={DRAW_WIDTH_MAX}
                  value={drawStrokeWidth}
                  onChange={(e) => onDrawStrokeWidthChange?.(Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                className={styles.drawClearBtn}
                title={role === 'dm' ? 'Clear all drawings' : 'Clear your drawings'}
                onClick={onDrawClear}
              >
                {role === 'dm' ? 'Clear All' : 'Clear Mine'}
              </button>
            </div>
          )}
        </div>
      )}
      {/* NPC token placement — DM only */}
      {role === 'dm' && (
        <>
          <div className={styles.divider} />
          <div className={styles.toolGroup}>
            <button
              type="button"
              className={`${styles.toolBtn} ${activeTool === 'npc-place' ? styles.active : ''}`}
              title="NPC tokens — drag Ally or Enemy onto the map (DM only)"
              aria-pressed={activeTool === 'npc-place'}
              onClick={() => onToolChange(activeTool === 'npc-place' ? 'select' : 'npc-place')}
            >
              <span className={styles.icon}>🧌</span>
              <span className={styles.label}>NPC</span>
            </button>
            {activeTool === 'npc-place' && (
              <div className={`${styles.toolPanel} ${styles.npcPanel}`}>
                <div
                  className={`${styles.npcDragItem} ${styles.npcDragItemAlly}`}
                  draggable
                  role="button"
                  aria-label="Ally — drag to canvas"
                  title="Drag to place ally NPC token"
                  onDragStart={(e: DragEvent<HTMLDivElement>): void => {
                    e.dataTransfer.setData(NPC_DRAG_MIME, 'ally' satisfies NpcSubtype);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  Ally
                </div>
                <div
                  className={`${styles.npcDragItem} ${styles.npcDragItemEnemy}`}
                  draggable
                  role="button"
                  aria-label="Enemy — drag to canvas"
                  title="Drag to place enemy NPC token"
                  onDragStart={(e: DragEvent<HTMLDivElement>): void => {
                    e.dataTransfer.setData(NPC_DRAG_MIME, 'enemy' satisfies NpcSubtype);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  Enemy
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {/* Fog of War tool — DM only */}
      {role === 'dm' && (
        <>
          <div className={styles.divider} />
          <div className={styles.toolGroup}>
            <button
              type="button"
              className={`${styles.toolBtn} ${isFogActive ? styles.active : ''}`}
              title="Fog of War — reveal or hide areas (DM only)"
              aria-pressed={isFogActive}
              onClick={() => onToolChange(isFogActive ? 'select' : 'fog-reveal')}
            >
              <span className={styles.icon}>🌫</span>
              <span className={styles.label}>Fog</span>
            </button>
            {isFogActive && (
              <div className={`${styles.toolPanel} ${styles.fogPanel}`}>
                <div className={styles.fogSubMode}>
                  <button
                    type="button"
                    className={`${styles.fogModeBtn} ${activeTool === 'fog-reveal' ? styles.fogModeBtnActive : ''}`}
                    title="Reveal fog area"
                    aria-pressed={activeTool === 'fog-reveal'}
                    onClick={() => onToolChange('fog-reveal')}
                  >
                    Reveal
                  </button>
                  <button
                    type="button"
                    className={`${styles.fogModeBtn} ${activeTool === 'fog-hide' ? styles.fogModeBtnActive : ''}`}
                    title="Hide fog area"
                    aria-pressed={activeTool === 'fog-hide'}
                    onClick={() => onToolChange('fog-hide')}
                  >
                    Hide
                  </button>
                </div>
                {onFogViewModeChange && (
                  <label className={styles.fogViewToggle}>
                    <input
                      type="checkbox"
                      checked={fogViewMode === 'player'}
                      onChange={(e) => onFogViewModeChange(e.target.checked ? 'player' : 'dm')}
                    />
                    <span>Player view</span>
                  </label>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
