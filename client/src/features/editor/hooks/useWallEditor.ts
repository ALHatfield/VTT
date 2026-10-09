// useWallEditor — Phase 5F
// Wires wall data, the Pixi WallOverlay, and editor UI state for the play-area root.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { WallSegment, WallSegmentCreatePayload } from '@vtt/shared';

import type { CanvasManager } from '../../play-area/canvas/CanvasManager';
import type { WallDraft } from '../canvas/WallOverlay';
import { WallOverlay } from '../canvas/WallOverlay';
import type { WallsSectionProps } from '../components/WallsSection';
import type { WallToolOverlayProps } from '../components/WallToolOverlay';
import type { WallEndpoint, WallPoint } from '../utils/wall-geometry';
import { endpointPatch } from '../utils/wall-geometry';
import { useUndoableCrud } from './useUndoableCrud';
import type { UndoHistory } from './useUndoRedo';
import { useWallSegments } from './useWallSegments';

interface UseWallEditorOptions {
  campaignId: string | undefined;
  sceneId: string | undefined;
  canvasManager: CanvasManager | null;
  isReady: boolean;
  isEditorMode: boolean;
  isDm: boolean;
  cellSize: number;
  history: UndoHistory;
}

interface UseWallEditorReturn {
  /** Props for the LayersPanel walls tab; null for non-DMs. */
  sectionProps: WallsSectionProps | null;
  /** Props for the pointer-capture layer; null unless the wall tool is active. */
  toolOverlayProps: WallToolOverlayProps | null;
  refreshWalls: () => Promise<void>;
}

function toWallCreatePayload({
  x1,
  y1,
  x2,
  y2,
  blocksLight,
  blocksMovement,
  isDoor,
  isOpen,
}: WallSegment): WallSegmentCreatePayload {
  return { x1, y1, x2, y2, blocksLight, blocksMovement, isDoor, isOpen };
}

export function useWallEditor({
  campaignId,
  sceneId,
  canvasManager,
  isReady,
  isEditorMode,
  isDm,
  cellSize,
  history,
}: UseWallEditorOptions): UseWallEditorReturn {
  const segments = useWallSegments(campaignId, sceneId, isDm);
  const { walls, error, refresh } = segments;
  const {
    create: createWall,
    update: updateWall,
    remove: deleteWall,
    removeAll: deleteAllWalls,
  } = useUndoableCrud({
    history,
    items: walls,
    kind: 'wall',
    create: segments.createWall,
    update: segments.updateWall,
    remove: segments.deleteWall,
    removeAll: segments.deleteAllWalls,
    toCreatePayload: toWallCreatePayload,
  });

  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [wallsVisible, setWallsVisible] = useState(true);
  const [isToolActive, setIsToolActive] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const overlayRef = useRef<WallOverlay | null>(null);

  const isAuthoring = isEditorMode && isDm;
  const activeSelectedId = walls.some((w) => w.id === selectedWallId) ? selectedWallId : null;

  // Mount the overlay on the Foreground layer for the lifetime of the canvas
  useEffect(() => {
    if (!canvasManager || !isReady) return;
    const overlay = new WallOverlay();
    canvasManager.foregroundLayer.addChild(overlay);
    overlayRef.current = overlay;
    return () => {
      overlayRef.current = null;
      // The canvas may already have torn down the stage (and this overlay with it)
      if (!overlay.destroyed) {
        overlay.removeFromParent();
        overlay.destroy({ children: true });
      }
    };
  }, [canvasManager, isReady]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.visible = isAuthoring && wallsVisible;
    overlay.setWalls(walls, activeSelectedId);
  }, [isAuthoring, wallsVisible, walls, activeSelectedId, canvasManager, isReady]);

  // Leaving editor mode ends any wall authoring session
  useEffect(() => {
    if (isAuthoring) return;
    setIsToolActive(false);
    setSelectedWallId(null);
  }, [isAuthoring]);

  // Bypasses React so pointermove never re-renders the play-area tree
  const handleDraftChange = useCallback((draft: WallDraft | null): void => {
    overlayRef.current?.setDraft(draft);
  }, []);

  const toggleTool = useCallback((): void => {
    // Tile selection would otherwise react to arrow/delete keys meant for walls
    if (!isToolActive) canvasManager?.clearTileSelection();
    setIsToolActive(!isToolActive);
    setWallsVisible(true);
  }, [canvasManager, isToolActive]);

  const deactivateTool = useCallback((): void => setIsToolActive(false), []);

  // Hidden walls can't be edited, so hiding also ends the tool session
  const toggleVisibility = useCallback((): void => {
    if (wallsVisible) setIsToolActive(false);
    setWallsVisible(!wallsVisible);
  }, [wallsVisible]);

  const handleDeleteWall = useCallback(
    (wallId: string): void => {
      if (wallId === selectedWallId) setSelectedWallId(null);
      void deleteWall(wallId);
    },
    [deleteWall, selectedWallId],
  );

  const handleDeleteAll = useCallback((): void => {
    setSelectedWallId(null);
    void deleteAllWalls();
  }, [deleteAllWalls]);

  const handleCreateSegment = useCallback(
    (start: WallPoint, end: WallPoint): void => {
      void createWall({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    },
    [createWall],
  );

  const handleMoveEndpoint = useCallback(
    (wallId: string, endpoint: WallEndpoint, point: WallPoint): void => {
      updateWall(wallId, endpointPatch(endpoint, point));
    },
    [updateWall],
  );

  const toWorld = useCallback(
    (screenX: number, screenY: number): WallPoint =>
      canvasManager?.screenToWorld(screenX, screenY) ?? { x: screenX, y: screenY },
    [canvasManager],
  );

  const handlePan = useCallback(
    (dx: number, dy: number): void => canvasManager?.pan(dx, dy),
    [canvasManager],
  );

  const sectionProps = useMemo(
    (): WallsSectionProps | null =>
      isDm
        ? {
            walls,
            selectedWallId: activeSelectedId,
            wallsVisible,
            isToolActive,
            snapToGrid,
            error,
            onToggleTool: toggleTool,
            onDeactivateTool: deactivateTool,
            onToggleSnap: () => setSnapToGrid((prev) => !prev),
            onToggleVisibility: toggleVisibility,
            onSelectWall: setSelectedWallId,
            onDeleteWall: handleDeleteWall,
            onDeleteAll: handleDeleteAll,
            onUpdateWall: updateWall,
          }
        : null,
    [
      isDm,
      walls,
      activeSelectedId,
      wallsVisible,
      isToolActive,
      snapToGrid,
      error,
      toggleTool,
      deactivateTool,
      toggleVisibility,
      handleDeleteWall,
      handleDeleteAll,
      updateWall,
    ],
  );

  const toolOverlayProps = useMemo(
    (): WallToolOverlayProps | null =>
      isAuthoring && isToolActive && wallsVisible && canvasManager
        ? {
            walls,
            selectedWallId: activeSelectedId,
            cellSize,
            snapToGrid,
            toWorld,
            onPan: handlePan,
            onCreateSegment: handleCreateSegment,
            onSelectWall: setSelectedWallId,
            onMoveEndpoint: handleMoveEndpoint,
            onDeleteWall: handleDeleteWall,
            onDraftChange: handleDraftChange,
          }
        : null,
    [
      isAuthoring,
      isToolActive,
      wallsVisible,
      canvasManager,
      walls,
      activeSelectedId,
      cellSize,
      snapToGrid,
      toWorld,
      handlePan,
      handleCreateSegment,
      handleMoveEndpoint,
      handleDeleteWall,
      handleDraftChange,
    ],
  );

  return { sectionProps, toolOverlayProps, refreshWalls: refresh };
}
