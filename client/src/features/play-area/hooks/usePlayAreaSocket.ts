import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import type {
    ChatReceivedPayload,
    FogHiddenPayload,
    FogRevealedPayload,
    PresencePayload,
    SocketErrorPayload,
    TokenCreatedPayload,
    TokenDeletedPayload,
    TokenMovedPayload,
    TokenUpdatedPayload,
    TokenVisionSyncPayload,
} from '@vtt/shared';
import {
    CHAT_EVENTS,
    DICE_EVENTS,
    FOG_EVENTS,
    PLAY_AREA_EVENTS,
    SOCKET_TOKEN_MOVE_DEBOUNCE_MS,
    TOKEN_VISION_EVENTS,
} from '@vtt/shared';

interface UsePlayAreaSocketOptions {
  campaignId: string | undefined;
  onTokenMoved?: (payload: TokenMovedPayload) => void;
  onTokenUpdated?: (payload: TokenUpdatedPayload) => void;
  onTokenCreated?: (payload: TokenCreatedPayload) => void;
  onTokenDeleted?: (payload: TokenDeletedPayload) => void;
  onUserJoined?: (payload: PresencePayload) => void;
  onUserLeft?: (payload: PresencePayload) => void;
  onChatReceived?: (payload: ChatReceivedPayload) => void;
  onFogRevealed?: (payload: FogRevealedPayload) => void;
  onFogHidden?: (payload: FogHiddenPayload) => void;
  onVisionSync?: (payload: TokenVisionSyncPayload) => void;
  /** Called after a reconnect (not the initial connect). Use to re-sync state from REST. */
  onReconnect?: () => void;
}

interface UsePlayAreaSocketReturn {
  emitTokenMove: (tokenId: string, x: number, y: number) => void;
  emitChatSend: (text: string) => void;
  emitDiceRoll: (formula: string) => void;
  emitFogReveal: (sceneId: string, vertices: { x: number; y: number }[]) => void;
  emitFogHide: (sceneId: string, vertices: { x: number; y: number }[]) => void;
  isConnected: boolean;
}

/**
 * Manages the Socket.IO connection for the play area.
 *
 * - Connects to the server using session cookie credentials (Vite proxies /socket.io)
 * - Joins the campaign room on connect (and on every reconnect)
 * - Broadcasts token moves with 100ms debouncing to reduce network traffic during drags
 * - Stores callbacks in refs so the socket is never recreated on re-renders
 */
export function usePlayAreaSocket({
  campaignId,
  onTokenMoved,
  onTokenUpdated,
  onTokenCreated,
  onTokenDeleted,
  onUserJoined,
  onUserLeft,
  onChatReceived,
  onFogRevealed,
  onFogHidden,
  onVisionSync,
  onReconnect,
}: UsePlayAreaSocketOptions): UsePlayAreaSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Callback refs — updated on every render so socket effect has stable deps
  const onTokenMovedRef = useRef(onTokenMoved);
  const onTokenUpdatedRef = useRef(onTokenUpdated);
  const onTokenCreatedRef = useRef(onTokenCreated);
  const onTokenDeletedRef = useRef(onTokenDeleted);
  const onUserJoinedRef = useRef(onUserJoined);
  const onUserLeftRef = useRef(onUserLeft);
  const onChatReceivedRef = useRef(onChatReceived);
  const onFogRevealedRef = useRef(onFogRevealed);
  const onFogHiddenRef = useRef(onFogHidden);
  const onVisionSyncRef = useRef(onVisionSync);
  const onReconnectRef = useRef(onReconnect);

  useEffect(() => { onTokenMovedRef.current = onTokenMoved; }, [onTokenMoved]);
  useEffect(() => { onTokenUpdatedRef.current = onTokenUpdated; }, [onTokenUpdated]);
  useEffect(() => { onTokenCreatedRef.current = onTokenCreated; }, [onTokenCreated]);
  useEffect(() => { onTokenDeletedRef.current = onTokenDeleted; }, [onTokenDeleted]);
  useEffect(() => { onUserJoinedRef.current = onUserJoined; }, [onUserJoined]);
  useEffect(() => { onUserLeftRef.current = onUserLeft; }, [onUserLeft]);
  useEffect(() => { onChatReceivedRef.current = onChatReceived; }, [onChatReceived]);
  useEffect(() => { onFogRevealedRef.current = onFogRevealed; }, [onFogRevealed]);
  useEffect(() => { onFogHiddenRef.current = onFogHidden; }, [onFogHidden]);
  useEffect(() => { onVisionSyncRef.current = onVisionSync; }, [onVisionSync]);
  useEffect(() => { onReconnectRef.current = onReconnect; }, [onReconnect]);

  // Debounce state for token moves
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMoveRef = useRef<{ tokenId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!campaignId) return;

    // Connect to the server — Vite proxies /socket.io to localhost:3001 in dev
    const socket = io({
      withCredentials: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });
    socketRef.current = socket;

    const handleConnect = (): void => {
      setIsConnected(true);
      // (Re-)join campaign room after every connect/reconnect
      socket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
    };

    const handleDisconnect = (): void => {
      setIsConnected(false);
    };

    const handleReconnect = (): void => {
      // Re-join room (Socket.IO does not persist rooms across reconnects)
      socket.emit(PLAY_AREA_EVENTS.ROOM_JOIN, { campaignId });
      // Re-sync full token state from REST to recover any missed events
      onReconnectRef.current?.();
    };

    const handleTokenMoved = (payload: TokenMovedPayload): void => {
      onTokenMovedRef.current?.(payload);
    };

    const handleTokenUpdated = (payload: TokenUpdatedPayload): void => {
      onTokenUpdatedRef.current?.(payload);
    };

    const handleTokenCreated = (payload: TokenCreatedPayload): void => {
      onTokenCreatedRef.current?.(payload);
    };

    const handleTokenDeleted = (payload: TokenDeletedPayload): void => {
      onTokenDeletedRef.current?.(payload);
    };

    const handleUserJoined = (payload: PresencePayload): void => {
      onUserJoinedRef.current?.(payload);
    };

    const handleUserLeft = (payload: PresencePayload): void => {
      onUserLeftRef.current?.(payload);
    };

    const handleChatReceived = (payload: ChatReceivedPayload): void => {
      onChatReceivedRef.current?.(payload);
    };

    const handleFogRevealed = (payload: FogRevealedPayload): void => {
      onFogRevealedRef.current?.(payload);
    };

    const handleFogHidden = (payload: FogHiddenPayload): void => {
      onFogHiddenRef.current?.(payload);
    };

    const handleVisionSync = (payload: TokenVisionSyncPayload): void => {
      onVisionSyncRef.current?.(payload);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    // In Socket.IO v4 the 'reconnect' event is emitted by the Manager, not the Socket
    socket.io.on('reconnect', handleReconnect);
    socket.on(PLAY_AREA_EVENTS.TOKEN_MOVED, handleTokenMoved);
    socket.on(PLAY_AREA_EVENTS.TOKEN_UPDATED, handleTokenUpdated);
    socket.on(PLAY_AREA_EVENTS.TOKEN_CREATED, handleTokenCreated);
    socket.on(PLAY_AREA_EVENTS.TOKEN_DELETED, handleTokenDeleted);
    socket.on(PLAY_AREA_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(PLAY_AREA_EVENTS.USER_LEFT, handleUserLeft);
    socket.on(CHAT_EVENTS.CHAT_RECEIVED, handleChatReceived);
    socket.on(FOG_EVENTS.FOG_REVEALED, handleFogRevealed);
    socket.on(FOG_EVENTS.FOG_HIDDEN, handleFogHidden);
    socket.on(TOKEN_VISION_EVENTS.TOKEN_VISION_SYNC, handleVisionSync);
    socket.on(PLAY_AREA_EVENTS.ERROR, (payload: SocketErrorPayload) => {
      console.error('[PlayAreaSocket] Server error:', payload.code, payload.message);
    });

    return (): void => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      socket.io.off('reconnect', handleReconnect);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [campaignId]);

  const emitTokenMove = useCallback(
    (tokenId: string, x: number, y: number): void => {
      if (!campaignId) return;

      // Debounce: collapse rapid drag events, emit only the latest position after idle
      pendingMoveRef.current = { tokenId, x, y };

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout((): void => {
        const move = pendingMoveRef.current;
        if (move && socketRef.current?.connected) {
          socketRef.current.emit(PLAY_AREA_EVENTS.TOKEN_MOVE, {
            ...move,
            campaignId,
          });
        }
        pendingMoveRef.current = null;
        debounceTimerRef.current = null;
      }, SOCKET_TOKEN_MOVE_DEBOUNCE_MS);
    },
    [campaignId],
  );

  const emitChatSend = useCallback(
    (text: string): void => {
      if (!campaignId || !socketRef.current?.connected) return;
      socketRef.current.emit(CHAT_EVENTS.CHAT_SEND, { campaignId, text });
    },
    [campaignId],
  );

  const emitDiceRoll = useCallback(
    (formula: string): void => {
      if (!campaignId || !socketRef.current?.connected) return;
      socketRef.current.emit(DICE_EVENTS.DICE_ROLL, { campaignId, formula });
    },
    [campaignId],
  );

  const emitFogReveal = useCallback(
    (sceneId: string, vertices: { x: number; y: number }[]): void => {
      if (!campaignId || !socketRef.current?.connected) return;
      socketRef.current.emit(FOG_EVENTS.FOG_REVEAL, { campaignId, sceneId, vertices });
    },
    [campaignId],
  );

  const emitFogHide = useCallback(
    (sceneId: string, vertices: { x: number; y: number }[]): void => {
      if (!campaignId || !socketRef.current?.connected) return;
      socketRef.current.emit(FOG_EVENTS.FOG_HIDE, { campaignId, sceneId, vertices });
    },
    [campaignId],
  );

  return { emitTokenMove, emitChatSend, emitDiceRoll, emitFogReveal, emitFogHide, isConnected };
}
