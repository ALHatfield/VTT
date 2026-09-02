import type { DragEvent } from 'react';
import { useCallback } from 'react';

import type { NpcSubtype, Token, TokenCreatePayload } from '@vtt/shared';

import type { CanvasManager } from '../canvas/CanvasManager';

export const NPC_DRAG_MIME = 'application/vtt-npc-subtype';

const NPC_DEFAULT_NAMES: Record<NpcSubtype, string> = {
  ally: 'Ally',
  enemy: 'Enemy',
};

const DEFAULT_NPC_SIZE = 1;

interface UseNpcDropOptions {
  canvasManager: CanvasManager | null;
  createToken: (payload: TokenCreatePayload) => Promise<Token>;
  cellSize: number;
  isActive: boolean;
}

interface UseNpcDropReturn {
  handleDragOver: (e: DragEvent<HTMLElement>) => void;
  handleDrop: (e: DragEvent<HTMLElement>) => void;
}

export function useNpcDrop({
  canvasManager,
  createToken,
  cellSize,
  isActive,
}: UseNpcDropOptions): UseNpcDropReturn {
  const handleDragOver = useCallback(
    (e: DragEvent<HTMLElement>): void => {
      if (!isActive) return;
      if (!e.dataTransfer.types.includes(NPC_DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    [isActive],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>): void => {
      if (!isActive || !canvasManager) return;
      const rawSubtype = e.dataTransfer.getData(NPC_DRAG_MIME);
      if (rawSubtype !== 'ally' && rawSubtype !== 'enemy') return;
      const subtype: NpcSubtype = rawSubtype;
      e.preventDefault();

      const rect = e.currentTarget.getBoundingClientRect();
      const world = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const gridX = Math.max(0, Math.round(world.x / cellSize));
      const gridY = Math.max(0, Math.round(world.y / cellSize));

      createToken({
        name: NPC_DEFAULT_NAMES[subtype],
        type: 'npc',
        npcSubtype: subtype,
        x: gridX,
        y: gridY,
        size: DEFAULT_NPC_SIZE,
      }).catch((err: unknown) => {
        console.error('[useNpcDrop] Failed to create NPC token:', err);
      });
    },
    [isActive, canvasManager, createToken, cellSize],
  );

  return { handleDragOver, handleDrop };
}
