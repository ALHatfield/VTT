import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

import type {
    CharacterAssignmentChangedPayload,
    CharacterHpUpdatedPayload,
    CharacterLinkUpdatedPayload,
    CharacterSheetUpdatedPayload,
    DiceRollPayload,
    SocketErrorPayload,
} from '@vtt/shared';
import { CHARACTER_EVENTS, DICE_EVENTS, PLAY_AREA_EVENTS } from '@vtt/shared';

interface UseCharacterSocketOptions {
  campaignId: string | undefined;
  /** A character's HP changed (sheet ↔ token sync) */
  onHpUpdated?: (payload: CharacterHpUpdatedPayload) => void;
  /** A character-token link was created or removed */
  onLinkUpdated?: (payload: CharacterLinkUpdatedPayload) => void;
  /** A character was assigned to a different user */
  onAssignmentChanged?: (payload: CharacterAssignmentChangedPayload) => void;
  /** A character sheet was edited by the DM or owner (Phase 6D) */
  onSheetUpdated?: (payload: CharacterSheetUpdatedPayload) => void;
}

interface UseCharacterSocketReturn {
  /** Sends a dice roll to the campaign chat (Phase 6C interactive rolling) */
  emitDiceRoll: (formula: string, label?: string) => void;
  /** True once the campaign room join has been confirmed */
  isConnected: boolean;
  /** Last server rejection (invalid roll, cooldown, forbidden); cleared on the next roll */
  lastError: string | null;
}

/**
 * Subscribes to characters-feature broadcasts for a campaign.
 *
 * Joins the campaign room on every connect (Socket.IO re-fires `connect` after
 * reconnects) and stores callbacks in refs so the socket is never recreated on
 * re-renders. Uses a dedicated connection via `io({ forceNew: true })` so
 * cleanup cannot disconnect sockets owned by other features.
 */
export function useCharacterSocket({
  campaignId,
  onHpUpdated,
  onLinkUpdated,
  onAssignmentChanged,
  onSheetUpdated,
}: UseCharacterSocketOptions): UseCharacterSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const onHpUpdatedRef = useRef(onHpUpdated);
  const onLinkUpdatedRef = useRef(onLinkUpdated);
  const onAssignmentChangedRef = useRef(onAssignmentChanged);
  const onSheetUpdatedRef = useRef(onSheetUpdated);

  useEffect(() => {
    onHpUpdatedRef.current = onHpUpdated;
    onLinkUpdatedRef.current = onLinkUpdated;
    onAssignmentChangedRef.current = onAssignmentChanged;
    onSheetUpdatedRef.current = onSheetUpdated;
  }, [onHpUpdated, onLinkUpdated, onAssignmentChanged, onSheetUpdated]);

  useEffect(() => {
    if (!campaignId) return undefined;

    const socket = io({ withCredentials: true, forceNew: true });
    socketRef.current = socket;

    const handleConnect = (): void => {
      socket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
    };

    // The room join is confirmed by the server's user-joined broadcast —
    // rolls emitted before then would be rejected as FORBIDDEN.
    const handleUserJoined = (): void => {
      setIsConnected(true);
    };

    const handleDisconnect = (): void => {
      setIsConnected(false);
    };

    const handleError = (payload: SocketErrorPayload): void => {
      setLastError(payload.message);
    };

    const handleHpUpdated = (payload: CharacterHpUpdatedPayload): void => {
      onHpUpdatedRef.current?.(payload);
    };

    const handleLinkUpdated = (payload: CharacterLinkUpdatedPayload): void => {
      onLinkUpdatedRef.current?.(payload);
    };

    const handleAssignmentChanged = (payload: CharacterAssignmentChangedPayload): void => {
      onAssignmentChangedRef.current?.(payload);
    };

    const handleSheetUpdated = (payload: CharacterSheetUpdatedPayload): void => {
      onSheetUpdatedRef.current?.(payload);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on(PLAY_AREA_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(PLAY_AREA_EVENTS.ERROR, handleError);
    socket.on(CHARACTER_EVENTS.HP_UPDATED, handleHpUpdated);
    socket.on(CHARACTER_EVENTS.LINK_UPDATED, handleLinkUpdated);
    socket.on(CHARACTER_EVENTS.ASSIGNMENT_CHANGED, handleAssignmentChanged);
    socket.on(CHARACTER_EVENTS.SHEET_UPDATED, handleSheetUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off(PLAY_AREA_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(PLAY_AREA_EVENTS.ERROR, handleError);
      socket.off(CHARACTER_EVENTS.HP_UPDATED, handleHpUpdated);
      socket.off(CHARACTER_EVENTS.LINK_UPDATED, handleLinkUpdated);
      socket.off(CHARACTER_EVENTS.ASSIGNMENT_CHANGED, handleAssignmentChanged);
      socket.off(CHARACTER_EVENTS.SHEET_UPDATED, handleSheetUpdated);
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [campaignId]);

  const emitDiceRoll = useCallback(
    (formula: string, label?: string): void => {
      if (!campaignId || !socketRef.current?.connected) return;
      setLastError(null);
      const payload: DiceRollPayload = { campaignId, formula };
      if (label !== undefined) payload.label = label;
      socketRef.current.emit(DICE_EVENTS.DICE_ROLL, payload);
    },
    [campaignId],
  );

  return { emitDiceRoll, isConnected, lastError };
}
