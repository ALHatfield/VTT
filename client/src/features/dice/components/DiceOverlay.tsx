import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';

import type { DiceAnimator } from '../dice3d/animator';
import { createDiceAnimator } from '../dice3d/animator';
import type { PendingDiceRoll } from '../hooks/use3dDiceReveal';
import styles from './DiceOverlay.module.css';

interface DiceOverlayProps {
  /** Rolls to animate — each new rollId triggers its own throw; rolls coexist. */
  pendingRolls: PendingDiceRoll[];
  /** Fired when all dice in a roll have settled showing their authoritative faces. */
  onRollComplete: (rollId: string) => void;
  /** Fired when the 3D animator cannot be created — caller should fall back to instant reveal. */
  onAnimatorError?: () => void;
  /** Dev toggle — enables orbit/zoom and makes the overlay capture the pointer. */
  cameraControlsEnabled: boolean;
}

/**
 * Transparent Three.js canvas layered over the PixiJS map. Pointer events pass
 * through (unless dev camera controls are on) so map interaction is never blocked.
 */
export function DiceOverlay({
  pendingRolls,
  onRollComplete,
  onAnimatorError,
  cameraControlsEnabled,
}: DiceOverlayProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animatorRef = useRef<DiceAnimator | null>(null);
  const onRollCompleteRef = useRef(onRollComplete);
  const onAnimatorErrorRef = useRef(onAnimatorError);
  const pendingRollsRef = useRef(pendingRolls);
  // Guards against playing the same roll twice (mount race + effect)
  const playedRollIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    onRollCompleteRef.current = onRollComplete;
    onAnimatorErrorRef.current = onAnimatorError;
    pendingRollsRef.current = pendingRolls;
  }, [onRollComplete, onAnimatorError, pendingRolls]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let animator: DiceAnimator | null = null;

    // Plays every pending roll that hasn't been thrown yet
    const playNewRolls = (target: DiceAnimator): void => {
      for (const roll of pendingRollsRef.current) {
        if (!playedRollIdsRef.current.has(roll.rollId)) {
          playedRollIdsRef.current.add(roll.rollId);
          target.playRoll(roll.rollId, roll.dice, roll.rollerName);
        }
      }
    };

    createDiceAnimator(canvas, {
      onRollComplete: (rollId) => onRollCompleteRef.current(rollId),
    })
      .then((created) => {
        if (cancelled) {
          created.dispose();
          return;
        }
        animator = created;
        animatorRef.current = created;
        // Rolls may have arrived while the animator was still initializing
        playNewRolls(created);
      })
      .catch((err: unknown) => {
        console.error('[DiceOverlay] Failed to create dice animator:', err);
        // Signal the caller to fall back to instant reveal
        onAnimatorErrorRef.current?.();
      });

    return (): void => {
      cancelled = true;
      animatorRef.current = null;
      animator?.dispose();
    };
  }, []);

  useEffect(() => {
    const animator = animatorRef.current;
    if (animator) {
      for (const roll of pendingRolls) {
        if (!playedRollIdsRef.current.has(roll.rollId)) {
          playedRollIdsRef.current.add(roll.rollId);
          animator.playRoll(roll.rollId, roll.dice, roll.rollerName);
        }
      }
    }
    // Forget revealed rolls so the played set can't grow unbounded
    const pendingIds = new Set(pendingRolls.map((r) => r.rollId));
    for (const id of playedRollIdsRef.current) {
      if (!pendingIds.has(id)) playedRollIdsRef.current.delete(id);
    }
  }, [pendingRolls]);

  useEffect(() => {
    animatorRef.current?.setCameraControlsEnabled(cameraControlsEnabled);
  }, [cameraControlsEnabled]);

  return (
    <div
      className={`${styles.overlay} ${cameraControlsEnabled ? styles.interactive : ''}`}
      data-testid="dice-overlay"
    >
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
