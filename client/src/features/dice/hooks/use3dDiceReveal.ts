import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatMessage } from '@vtt/shared';
import { DICE_3D_MAX_CONCURRENT_ROLLS, DICE_3D_REVEAL_TIMEOUT_MS } from '@vtt/shared';

import type { Mapped3dDie } from '../dice3d/roll-mapping';
import { mapRollToDice } from '../dice3d/roll-mapping';

export interface PendingDiceRoll {
  rollId: string;
  dice: Mapped3dDie[];
  /** Username of the roller — rendered as a name tag under the dice. */
  rollerName: string;
}

interface HeldRoll {
  message: ChatMessage;
  timeout: ReturnType<typeof setTimeout>;
}

interface Use3dDiceRevealArgs {
  /** When false every message passes straight through to chat. */
  enabled: boolean;
  /** Appends a message to the chat log. */
  addMessage: (message: ChatMessage) => void;
}

interface Use3dDiceRevealReturn {
  /** Route an incoming socket message — roll messages may be held for animation. */
  handleIncomingMessage: (message: ChatMessage) => void;
  /** All rolls the overlay should currently be animating — one per roller. */
  pendingRolls: PendingDiceRoll[];
  /** Overlay callback — reveals a held message once its dice have settled. */
  handleRollComplete: (rollId: string) => void;
}

/**
 * Holds server roll messages while their 3D dice animations play, revealing
 * each in chat when its dice settle. Rolls from different players animate
 * concurrently — everyone's dice share the table. The server result is never
 * altered; the animation is presentation only. A per-roll safety timeout
 * guarantees every held message is eventually revealed.
 */
export function use3dDiceReveal({ enabled, addMessage }: Use3dDiceRevealArgs): Use3dDiceRevealReturn {
  const [pendingRolls, setPendingRolls] = useState<PendingDiceRoll[]>([]);
  const heldRef = useRef<Map<string, HeldRoll>>(new Map());
  // Route addMessage through a ref so an identity change can never trigger the
  // flush effect and prematurely reveal a held roll
  const addMessageRef = useRef(addMessage);
  useEffect(() => {
    addMessageRef.current = addMessage;
  }, [addMessage]);

  const revealRoll = useCallback((rollId: string): void => {
    const held = heldRef.current.get(rollId);
    if (!held) return;
    clearTimeout(held.timeout);
    heldRef.current.delete(rollId);
    addMessageRef.current(held.message);
    setPendingRolls((prev) => prev.filter((r) => r.rollId !== rollId));
  }, []);

  const flushAll = useCallback((): void => {
    // Map preserves insertion order — messages reveal in arrival order
    for (const held of heldRef.current.values()) {
      clearTimeout(held.timeout);
      addMessageRef.current(held.message);
    }
    heldRef.current.clear();
    setPendingRolls([]);
  }, []);

  // Flush on unmount or when 3D mode turns off so no message is ever lost
  useEffect(() => {
    if (!enabled) flushAll();
    return flushAll;
  }, [enabled, flushAll]);

  const handleIncomingMessage = useCallback(
    (message: ChatMessage): void => {
      if (!enabled || message.type !== 'roll' || message.rollData == null) {
        addMessageRef.current(message);
        return;
      }

      const dice = mapRollToDice(message.rollData);
      if (!dice) {
        // Malformed or unsupported roll — instant reveal
        addMessageRef.current(message);
        return;
      }

      // Table is full — reveal the oldest held roll to make room
      if (heldRef.current.size >= DICE_3D_MAX_CONCURRENT_ROLLS) {
        const oldest = heldRef.current.keys().next().value;
        if (oldest !== undefined) revealRoll(oldest);
      }

      const timeout = setTimeout(() => {
        revealRoll(message.id);
      }, DICE_3D_REVEAL_TIMEOUT_MS);
      heldRef.current.set(message.id, { message, timeout });
      setPendingRolls((prev) => [
        ...prev,
        { rollId: message.id, dice, rollerName: message.username },
      ]);
    },
    [enabled, revealRoll],
  );

  return { handleIncomingMessage, pendingRolls, handleRollComplete: revealRoll };
}
