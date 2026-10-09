// useTemporaryLightDrop — Phase PM4
// DM drags an emitter preset from the Lights tool panel onto the canvas to place a
// session-scoped temporary light.
import type { DragEvent } from 'react';
import { useCallback } from 'react';

import type { LightEmitterType, TemporaryLightCreatePayload } from '@vtt/shared';
import { LIGHT_EMITTER_TYPES } from '@vtt/shared';

import type { CanvasManager } from '../canvas/CanvasManager';

export const TEMPORARY_LIGHT_DRAG_MIME = 'application/vtt-temporary-light';

function isEmitterType(value: string): value is LightEmitterType {
  return (LIGHT_EMITTER_TYPES as readonly string[]).includes(value);
}

interface UseTemporaryLightDropOptions {
  canvasManager: CanvasManager | null;
  campaignId: string | undefined;
  sceneId: string | undefined;
  isActive: boolean;
  emitLightCreate: (payload: TemporaryLightCreatePayload) => void;
}

interface UseTemporaryLightDropReturn {
  handleDragOver: (e: DragEvent<HTMLElement>) => void;
  handleDrop: (e: DragEvent<HTMLElement>) => void;
}

export function useTemporaryLightDrop({
  canvasManager,
  campaignId,
  sceneId,
  isActive,
  emitLightCreate,
}: UseTemporaryLightDropOptions): UseTemporaryLightDropReturn {
  const handleDragOver = useCallback(
    (e: DragEvent<HTMLElement>): void => {
      if (!isActive) return;
      if (!e.dataTransfer.types.includes(TEMPORARY_LIGHT_DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    [isActive],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>): void => {
      if (!isActive || !canvasManager || !campaignId || !sceneId) return;
      const emitterType = e.dataTransfer.getData(TEMPORARY_LIGHT_DRAG_MIME);
      if (!isEmitterType(emitterType)) return;
      e.preventDefault();

      const rect = e.currentTarget.getBoundingClientRect();
      const world = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      emitLightCreate({ campaignId, sceneId, emitterType, x: world.x, y: world.y });
    },
    [isActive, canvasManager, campaignId, sceneId, emitLightCreate],
  );

  return { handleDragOver, handleDrop };
}
