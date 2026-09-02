import { useCallback, useEffect, useRef } from 'react';

import type { DrawShapeType, DrawStrokePayload } from '@vtt/shared';
import { DRAW_THROTTLE_MS } from '@vtt/shared';

import type { CanvasManager } from '../canvas/CanvasManager';

interface UseDrawToolOptions {
  canvasManager: CanvasManager | null;
  userId: string | undefined;
  campaignId: string | undefined;
  isActive: boolean;
  shapeType: DrawShapeType;
  strokeColor: string;
  strokeWidth: number;
  emitDrawStroke: (payload: DrawStrokePayload) => void;
  emitDrawClear: (payload: { campaignId: string; scope: 'own' | 'all' }) => void;
}

interface UseDrawToolReturn {
  handlePointerDown: (worldX: number, worldY: number) => void;
  handlePointerMove: (worldX: number, worldY: number) => void;
  handlePointerUp: () => void;
}

/**
 * Manages the draw tool interaction:
 * - Freehand: accumulates points, renders + streams at ~30fps
 * - Shapes (rect, circle): tracks start/end points, re-renders on each move
 * - Finalizes stroke on pointer up and emits a final socket payload
 * - Clears in-progress strokes when the tool is deactivated
 */
export function useDrawTool({
  canvasManager,
  userId,
  campaignId,
  isActive,
  shapeType,
  strokeColor,
  strokeWidth,
  emitDrawStroke,
  emitDrawClear,
}: UseDrawToolOptions): UseDrawToolReturn {
  const isDraggingRef = useRef(false);
  const strokeIdRef = useRef<string | null>(null);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const lastEmitTimeRef = useRef(0);
  // Track the last emitted points count so the final emit always sends the full set
  const lastEmitPointCountRef = useRef(0);

  // Clear in-progress local stroke when tool deactivates; notify peers via clear:own
  useEffect(() => {
    if (!isActive && isDraggingRef.current && strokeIdRef.current && userId) {
      canvasManager?.playgroundLayer.clearDrawings('own', userId);
      if (campaignId) {
        emitDrawClear({ campaignId, scope: 'own' });
      }
    }
    if (!isActive) {
      isDraggingRef.current = false;
      strokeIdRef.current = null;
      pointsRef.current = [];
      lastEmitTimeRef.current = 0;
      lastEmitPointCountRef.current = 0;
    }
  }, [isActive, canvasManager, userId, campaignId, emitDrawClear]);

  const handlePointerDown = useCallback(
    (worldX: number, worldY: number) => {
      if (!isActive) return;
      const startPoint = { x: worldX, y: worldY };
      strokeIdRef.current = crypto.randomUUID();
      pointsRef.current = [startPoint];
      isDraggingRef.current = true;
      lastEmitTimeRef.current = Date.now();
      lastEmitPointCountRef.current = 0;
      // Seed the stroke in PlaygroundLayer so the first move has a start point to connect to
      canvasManager?.playgroundLayer.addOrUpdateDrawStroke(
        userId ?? 'local',
        strokeIdRef.current,
        [startPoint],
        strokeColor,
        strokeWidth,
        shapeType,
      );
    },
    [isActive, canvasManager, userId, strokeColor, strokeWidth, shapeType],
  );

  const handlePointerMove = useCallback(
    (worldX: number, worldY: number) => {
      if (!isActive || !isDraggingRef.current || !strokeIdRef.current) return;

      const point = { x: worldX, y: worldY };

      if (shapeType === 'freehand') {
        pointsRef.current.push(point);
        // Pass only the new delta point — PlaygroundLayer accumulates for freehand
        canvasManager?.playgroundLayer.addOrUpdateDrawStroke(
          userId ?? 'local',
          strokeIdRef.current,
          [point],
          strokeColor,
          strokeWidth,
          shapeType,
        );
      } else {
        // Shape: keep start point, replace end point
        pointsRef.current = [pointsRef.current[0], point];
        // Pass full [start, end] — PlaygroundLayer replaces for shapes
        canvasManager?.playgroundLayer.addOrUpdateDrawStroke(
          userId ?? 'local',
          strokeIdRef.current,
          pointsRef.current,
          strokeColor,
          strokeWidth,
          shapeType,
        );
      }

      // Throttled socket broadcast
      const now = Date.now();
      if (now - lastEmitTimeRef.current < DRAW_THROTTLE_MS || !campaignId) return;

      lastEmitTimeRef.current = now;
      const newPoints =
        shapeType === 'freehand'
          ? pointsRef.current.slice(lastEmitPointCountRef.current)
          : [...pointsRef.current];
      lastEmitPointCountRef.current = pointsRef.current.length;

      emitDrawStroke({
        campaignId,
        strokeId: strokeIdRef.current,
        points: newPoints,
        color: strokeColor,
        width: strokeWidth,
        shapeType,
        isFinal: false,
      });
    },
    [
      isActive,
      shapeType,
      userId,
      campaignId,
      strokeColor,
      strokeWidth,
      canvasManager,
      emitDrawStroke,
    ],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current || !strokeIdRef.current) return;

    isDraggingRef.current = false;
    const strokeId = strokeIdRef.current;
    strokeIdRef.current = null;

    if (!campaignId || pointsRef.current.length === 0) {
      pointsRef.current = [];
      lastEmitPointCountRef.current = 0;
      return;
    }

    // Always emit isFinal=true; include remaining points or the last point as a marker
    const remainingPoints =
      shapeType === 'freehand'
        ? pointsRef.current.slice(lastEmitPointCountRef.current)
        : [...pointsRef.current];

    const pointsToSend =
      remainingPoints.length > 0
        ? remainingPoints
        : [pointsRef.current[pointsRef.current.length - 1]];

    emitDrawStroke({
      campaignId,
      strokeId,
      points: pointsToSend,
      color: strokeColor,
      width: strokeWidth,
      shapeType,
      isFinal: true,
    });

    pointsRef.current = [];
    lastEmitPointCountRef.current = 0;
  }, [campaignId, shapeType, strokeColor, strokeWidth, emitDrawStroke]);

  return { handlePointerDown, handlePointerMove, handlePointerUp };
}
