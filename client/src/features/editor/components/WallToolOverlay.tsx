// WallToolOverlay — Phase 5F
// Transparent DOM layer over the canvas that captures pointer input while the
// wall tool is active: click-to-place vertices, select, drag endpoints, delete.
import type { ReactElement, PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef } from 'react';

import type { WallSegment } from '@vtt/shared';

import type { WallDraft } from '../canvas/WallOverlay';
import type { WallEndpoint, WallPoint } from '../utils/wall-geometry';
import {
    findEndpointAtPoint,
    findWallAtPoint,
    isSamePoint,
    resolveWallPoint,
} from '../utils/wall-geometry';
import styles from './WallToolOverlay.module.css';

/** Screen-space pick radius (px) for walls and endpoint handles. */
const HIT_RADIUS_PX = 8;
const PRIMARY_BUTTON = 0;
const MIDDLE_BUTTON = 1;
const SECONDARY_BUTTON = 2;

export const WALL_TOOL_HINT_ID = 'wall-tool-hint';

interface EndpointDrag {
  wallId: string;
  endpoint: WallEndpoint;
  fixed: WallPoint;
  original: WallPoint;
  current: WallPoint;
}

export interface WallToolOverlayProps {
  walls: readonly WallSegment[];
  selectedWallId: string | null;
  cellSize: number;
  /** Grid snapping for placed points; holding Alt inverts it. */
  snapToGrid: boolean;
  /** Convert canvas-relative screen coordinates to world coordinates. */
  toWorld: (screenX: number, screenY: number) => WallPoint;
  onPan: (dx: number, dy: number) => void;
  onCreateSegment: (start: WallPoint, end: WallPoint) => void;
  onSelectWall: (wallId: string | null) => void;
  onMoveEndpoint: (wallId: string, endpoint: WallEndpoint, point: WallPoint) => void;
  onDeleteWall: (wallId: string) => void;
  onDraftChange: (draft: WallDraft | null) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isPanButton(button: number): boolean {
  return button === SECONDARY_BUTTON || button === MIDDLE_BUTTON;
}

function orderedDraft(drag: EndpointDrag): WallDraft {
  return drag.endpoint === 'start'
    ? { start: drag.current, end: drag.fixed, replacesWallId: drag.wallId }
    : { start: drag.fixed, end: drag.current, replacesWallId: drag.wallId };
}

export function WallToolOverlay({
  walls,
  selectedWallId,
  cellSize,
  snapToGrid,
  toWorld,
  onPan,
  onCreateSegment,
  onSelectWall,
  onMoveEndpoint,
  onDeleteWall,
  onDraftChange,
}: WallToolOverlayProps): ReactElement {
  const chainStartRef = useRef<WallPoint | null>(null);
  const dragRef = useRef<EndpointDrag | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Keep latest values for the window keydown listener
  const selectedWallIdRef = useRef(selectedWallId);
  const onDeleteWallRef = useRef(onDeleteWall);
  const onSelectWallRef = useRef(onSelectWall);
  const onDraftChangeRef = useRef(onDraftChange);
  useEffect(() => {
    selectedWallIdRef.current = selectedWallId;
    onDeleteWallRef.current = onDeleteWall;
    onSelectWallRef.current = onSelectWall;
    onDraftChangeRef.current = onDraftChange;
  }, [selectedWallId, onDeleteWall, onSelectWall, onDraftChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return;
      if (e.key === 'Escape') {
        if (chainStartRef.current) {
          chainStartRef.current = null;
          onDraftChangeRef.current(null);
        } else {
          onSelectWallRef.current(null);
        }
        return;
      }

      // Enter/Delete belong to focused panel controls unless the canvas has focus
      const active = document.activeElement;
      if (active !== document.body && active !== overlayRef.current) return;

      if (e.key === 'Enter' && chainStartRef.current) {
        chainStartRef.current = null;
        onDraftChangeRef.current(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWallIdRef.current) {
        e.preventDefault();
        onDeleteWallRef.current(selectedWallIdRef.current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      onDraftChangeRef.current(null);
    };
  }, []);

  const worldFromEvent = (e: ReactPointerEvent<HTMLDivElement>): WallPoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return toWorld(e.clientX - rect.left, e.clientY - rect.top);
  };

  const worldTolerance = (): number => {
    const origin = toWorld(0, 0);
    const offset = toWorld(HIT_RADIUS_PX, 0);
    return Math.abs(offset.x - origin.x);
  };

  const placePoint = (raw: WallPoint, altKey: boolean, excludeWallId?: string): WallPoint =>
    resolveWallPoint(raw, {
      walls,
      cellSize,
      snapToGrid: snapToGrid !== altKey,
      vertexTolerance: worldTolerance(),
      excludeWallId,
    });

  const beginChain = (point: WallPoint): void => {
    chainStartRef.current = point;
    onDraftChange({ start: point, end: point });
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.currentTarget.focus({ preventScroll: true });
    if (isPanButton(e.button)) {
      e.preventDefault();
      panRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== PRIMARY_BUTTON) return;

    const raw = worldFromEvent(e);
    const snapped = placePoint(raw, e.altKey);

    const chainStart = chainStartRef.current;
    if (chainStart) {
      if (!isSamePoint(chainStart, snapped)) onCreateSegment(chainStart, snapped);
      beginChain(snapped);
      return;
    }

    // Shift forces drawing so new walls can start on an existing vertex
    if (!e.shiftKey) {
      const tolerance = worldTolerance();
      const selected = walls.find((w) => w.id === selectedWallId);
      const target =
        selected && findEndpointAtPoint(selected, raw, tolerance)
          ? selected
          : findWallAtPoint(walls, raw, tolerance);

      if (target) {
        onSelectWall(target.id);
        const endpoint = findEndpointAtPoint(target, raw, tolerance);
        if (endpoint) {
          const original =
            endpoint === 'start' ? { x: target.x1, y: target.y1 } : { x: target.x2, y: target.y2 };
          const fixed =
            endpoint === 'start' ? { x: target.x2, y: target.y2 } : { x: target.x1, y: target.y1 };
          dragRef.current = { wallId: target.id, endpoint, fixed, original, current: original };
          e.currentTarget.setPointerCapture(e.pointerId);
          onDraftChange(orderedDraft(dragRef.current));
        }
        return;
      }
    }

    onSelectWall(null);
    beginChain(snapped);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const pan = panRef.current;
    if (pan) {
      onPan(e.clientX - pan.x, e.clientY - pan.y);
      panRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const drag = dragRef.current;
    const chainStart = chainStartRef.current;
    if (!drag && !chainStart) return;

    const snapped = placePoint(worldFromEvent(e), e.altKey, drag?.wallId);
    if (drag) {
      drag.current = snapped;
      onDraftChange(orderedDraft(drag));
    } else if (chainStart) {
      onDraftChange({ start: chainStart, end: snapped });
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (isPanButton(e.button)) {
      panRef.current = null;
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    onDraftChange(null);

    const { current, fixed, original } = drag;
    if (!isSamePoint(current, original) && !isSamePoint(current, fixed)) {
      onMoveEndpoint(drag.wallId, drag.endpoint, current);
    }
  };

  const handlePointerCancel = (): void => {
    panRef.current = null;
    if (!dragRef.current) return;
    dragRef.current = null;
    onDraftChange(null);
  };

  const handleDoubleClick = (): void => {
    chainStartRef.current = null;
    onDraftChange(null);
  };

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      data-testid="wall-tool-overlay"
      role="application"
      aria-label="Wall drawing canvas"
      aria-describedby={WALL_TOOL_HINT_ID}
      tabIndex={-1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
