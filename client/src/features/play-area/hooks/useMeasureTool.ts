import { useCallback, useEffect, useRef } from 'react';

import type { MeasureBroadcastPayload } from '@vtt/shared';

import type { CanvasManager } from '../canvas/CanvasManager';
import { snapToGridCenter } from '../canvas/grid-utils';

interface MeasurePoint {
  x: number;
  y: number;
}

/**
 * Calculates Euclidean distance in grid units between two world-pixel points.
 */
export function calcMeasureDistance(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  cellSize: number,
): number {
  const dx = (endX - startX) / cellSize;
  const dy = (endY - startY) / cellSize;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Format distance as a readable label (e.g. "3.5 sq").
 */
export function formatMeasureLabel(distanceInCells: number): string {
  return `${distanceInCells.toFixed(1)} sq`;
}

interface UseMeasureToolOptions {
  canvasManager: CanvasManager | null;
  cellSize: number;
  playerColor: string;
  campaignId: string | undefined;
  isActive: boolean;
  isPrivate: boolean;
  emitMeasureBroadcast: (payload: MeasureBroadcastPayload) => void;
  emitMeasureClear: (campaignId: string, isPrivate: boolean) => void;
}

interface UseMeasureToolReturn {
  handlePointerDown: (worldX: number, worldY: number) => void;
  handlePointerMove: (worldX: number, worldY: number) => void;
  handlePointerUp: () => void;
}

/**
 * Manages the measure tool interaction:
 * - Snap-to-grid-center start and end points
 * - Render the measurement line on PlaygroundLayer
 * - Broadcast via socket while dragging
 * - Clear on pointer up or tool deactivation
 */
export function useMeasureTool({
  canvasManager,
  cellSize,
  playerColor,
  campaignId,
  isActive,
  isPrivate,
  emitMeasureBroadcast,
  emitMeasureClear,
}: UseMeasureToolOptions): UseMeasureToolReturn {
  const isDraggingRef = useRef(false);
  const startPointRef = useRef<MeasurePoint | null>(null);

  const clearLine = useCallback(() => {
    canvasManager?.playgroundLayer.clearLocalMeasureLine();
    isDraggingRef.current = false;
    startPointRef.current = null;
  }, [canvasManager]);

  const doClear = useCallback(() => {
    clearLine();
    if (campaignId) emitMeasureClear(campaignId, isPrivate);
  }, [campaignId, isPrivate, clearLine, emitMeasureClear]);

  // Clear the line when the tool is deactivated
  useEffect(() => {
    if (!isActive) {
      doClear();
    }
  }, [isActive, doClear]);

  const handlePointerDown = useCallback(
    (worldX: number, worldY: number) => {
      if (!isActive) return;
      const snapped = snapToGridCenter(worldX, worldY, cellSize);
      startPointRef.current = snapped;
      isDraggingRef.current = true;
    },
    [isActive, cellSize],
  );

  const handlePointerMove = useCallback(
    (worldX: number, worldY: number) => {
      if (!isActive || !isDraggingRef.current || !startPointRef.current) return;

      const endSnapped = snapToGridCenter(worldX, worldY, cellSize);
      const { x: startX, y: startY } = startPointRef.current;
      const { x: endX, y: endY } = endSnapped;

      const dist = calcMeasureDistance(startX, startY, endX, endY, cellSize);
      const label = formatMeasureLabel(dist);

      canvasManager?.playgroundLayer.drawLocalMeasureLine(
        startX,
        startY,
        endX,
        endY,
        playerColor,
        label,
      );

      if (!campaignId) return;
      const payload: MeasureBroadcastPayload = {
        campaignId,
        startX,
        startY,
        endX,
        endY,
        color: playerColor,
        isPrivate,
      };
      emitMeasureBroadcast(payload);
    },
    [isActive, cellSize, playerColor, campaignId, isPrivate, canvasManager, emitMeasureBroadcast],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    doClear();
  }, [doClear]);

  return { handlePointerDown, handlePointerMove, handlePointerUp };
}
