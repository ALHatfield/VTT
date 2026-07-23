// useTileDragDrop — Phase 5B
// Handles drag-over and drop of assets from the AssetLibrary onto the canvas.
// Grid-snapping is delegated to CanvasManager.handleAssetDrop via screenToWorldForDrop.
import type { DragEvent } from 'react';
import { useCallback } from 'react';

import type { TileAsset } from '@vtt/shared';

import type { CanvasManager } from '../../play-area/canvas/CanvasManager';

/** Drag data MIME type set by AssetLibrary on dragstart. */
export const ASSET_DRAG_MIME = 'application/vtt-asset';

interface UseTileDragDropOptions {
  canvasManager: CanvasManager | null;
  isEditorMode: boolean;
}

interface UseTileDragDropReturn {
  handleDragOver: (e: DragEvent<HTMLElement>) => void;
  handleDrop: (e: DragEvent<HTMLElement>) => void;
}

/**
 * Provides drag-over and drop handlers for the canvas wrapper.
 * When an asset is dropped onto the canvas in editor mode, the asset's world
 * position is computed (with optional grid-snap via Alt key bypass) and
 * forwarded to CanvasManager.handleAssetDrop, which fires onTilePlaced.
 */
export function useTileDragDrop({
  canvasManager,
  isEditorMode,
}: UseTileDragDropOptions): UseTileDragDropReturn {
  const handleDragOver = useCallback(
    (e: DragEvent<HTMLElement>): void => {
      if (!isEditorMode) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    [isEditorMode],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>): void => {
      if (!isEditorMode || !canvasManager) return;
      e.preventDefault();

      const assetJson = e.dataTransfer.getData(ASSET_DRAG_MIME);
      if (!assetJson) return;

      let asset: TileAsset | null = null;
      try {
        const parsed = JSON.parse(assetJson) as unknown;
        // Minimal shape guard — reject malformed or cross-origin drag payloads
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          typeof (parsed as Record<string, unknown>).id === 'string' &&
          Number.isFinite((parsed as Record<string, unknown>).width) &&
          Number.isFinite((parsed as Record<string, unknown>).height)
        ) {
          asset = parsed as TileAsset;
        }
      } catch {
        return;
      }
      if (!asset) return;

      const rect = e.currentTarget.getBoundingClientRect();
      // altKey bypasses grid-snap for sub-grid placement (handled inside handleAssetDrop)
      canvasManager.handleAssetDrop(
        asset.id,
        asset.width,
        asset.height,
        asset.category,
        e.clientX,
        e.clientY,
        rect,
        e.altKey,
      );
    },
    [isEditorMode, canvasManager],
  );

  return { handleDragOver, handleDrop };
}
