import type { DiceDefinition } from '@vtt/dice';
import { DiceScene, createStandardDie } from '@vtt/dice';

import type { DiceAnimator, DiceAnimatorOptions } from './animator';
import type { Mapped3dDie } from './roll-mapping';

/** Three.js + cannon-es implementation of the DiceAnimator contract. */
export function createThreeDiceAnimator(
  canvas: HTMLCanvasElement,
  options: DiceAnimatorOptions,
): DiceAnimator {
  const scene = new DiceScene(canvas, { onRollComplete: options.onRollComplete });

  // Standard die definitions are shape-only — cache per side count
  const definitionCache = new Map<number, DiceDefinition>();
  const definitionFor = (sides: number): DiceDefinition => {
    let def = definitionCache.get(sides);
    if (!def) {
      def = createStandardDie(sides);
      definitionCache.set(sides, def);
    }
    return def;
  };

  return {
    playRoll(rollId: string, dice: Mapped3dDie[], rollerName?: string): void {
      scene.roll(
        rollId,
        dice.map(({ sides, value }) => ({
          definition: definitionFor(sides),
          // Standard dice have faces "1".."N", so faceIndex = value - 1
          faceIndex: value - 1,
        })),
        { label: rollerName },
      );
    },
    clear(): void {
      scene.clear();
    },
    setCameraControlsEnabled(enabled: boolean): void {
      scene.setCameraControlsEnabled(enabled);
    },
    dispose(): void {
      scene.dispose();
    },
  };
}
