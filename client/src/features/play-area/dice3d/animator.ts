import type { Mapped3dDie } from './roll-mapping';

/**
 * Renderer-agnostic contract for 3D dice animation (mirrors the FogMode
 * renderer-swap pattern). A different dice library only needs to implement
 * this interface and be returned from `createDiceAnimator`.
 */
export interface DiceAnimator {
  /** Throw the dice; each die must settle showing its authoritative value. */
  playRoll(rollId: string, dice: Mapped3dDie[], rollerName?: string): void;
  /** Remove any dice currently on screen. */
  clear(): void;
  /** Development aid — enable orbit/zoom camera controls. */
  setCameraControlsEnabled(enabled: boolean): void;
  /** Tear down all renderer resources. */
  dispose(): void;
}

export interface DiceAnimatorOptions {
  /** Fired when every die in the roll has settled on its result face. */
  onRollComplete: (rollId: string) => void;
}

/**
 * Create the active 3D dice animator bound to a canvas.
 * Currently backed by @vtt/dice (Three.js + cannon-es); swap the import here
 * to change libraries. Rejects when WebGL initialization fails.
 */
export async function createDiceAnimator(
  canvas: HTMLCanvasElement,
  options: DiceAnimatorOptions,
): Promise<DiceAnimator> {
  // Dynamic import keeps three/cannon-es out of the main bundle for users
  // who never enable 3D dice.
  const { createThreeDiceAnimator } = await import('./three-dice-animator');
  return createThreeDiceAnimator(canvas, options);
}
