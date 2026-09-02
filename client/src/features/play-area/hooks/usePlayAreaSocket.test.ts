import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AURA_EVENTS,
  INITIATIVE_EVENTS,
  PLAY_AREA_EVENTS,
  SOCKET_TOKEN_MOVE_DEBOUNCE_MS,
} from '@vtt/shared';

// ---------------------------------------------------------------------------
// Mock socket.io-client before importing the hook
// ---------------------------------------------------------------------------

const mockSocketOn = vi.fn();
const mockSocketEmit = vi.fn();
const mockSocketDisconnect = vi.fn();
const mockManagerOn = vi.fn();
const mockManagerOff = vi.fn();

const mockSocket = {
  on: mockSocketOn,
  off: vi.fn(),
  emit: mockSocketEmit,
  disconnect: mockSocketDisconnect,
  connected: true,
  io: {
    on: mockManagerOn,
    off: mockManagerOff,
  },
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// Import AFTER mocking
const { usePlayAreaSocket } = await import('./usePlayAreaSocket');
const { io: mockedIo } = await import('socket.io-client');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate a socket event by calling the handler registered via socket.on */
function triggerSocketEvent(event: string, payload?: unknown): void {
  const call = mockSocketOn.mock.calls.find(([e]) => e === event);
  if (!call) throw new Error(`No handler registered for event: ${event}`);
  act(() => {
    (call[1] as (p: unknown) => void)(payload);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePlayAreaSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSocketOn.mockClear();
    mockSocketEmit.mockClear();
    mockSocketDisconnect.mockClear();
    mockManagerOn.mockClear();
    mockManagerOff.mockClear();
    (mockedIo as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('socket lifecycle', () => {
    it('creates a socket when campaignId is provided', () => {
      renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));
      expect(mockedIo).toHaveBeenCalledOnce();
    });

    it('does not create a socket when campaignId is undefined', () => {
      renderHook(() => usePlayAreaSocket({ campaignId: undefined }));
      expect(mockedIo).not.toHaveBeenCalled();
    });

    it('disconnects the socket on unmount', () => {
      const { unmount } = renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));
      unmount();
      expect(mockSocketDisconnect).toHaveBeenCalledOnce();
    });

    it('emits room:join on connect', () => {
      renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));
      triggerSocketEvent('connect');
      expect(mockSocketEmit).toHaveBeenCalledWith(PLAY_AREA_EVENTS.ROOM_JOIN, {
        campaignId: 'campaign-1',
      });
    });

    it('re-emits room:join on reconnect', () => {
      renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));
      triggerSocketEvent('connect');
      // Reconnect fires on the Manager (socket.io), not the socket itself (Socket.IO v4)
      const call = mockManagerOn.mock.calls.find((args) => args[0] === 'reconnect');
      if (!call) throw new Error('No handler registered for manager event: reconnect');
      (call[1] as () => void)();
      expect(mockSocketEmit).toHaveBeenCalledTimes(2);
    });
  });

  describe('emitTokenMove debouncing', () => {
    it('does not emit immediately', () => {
      const { result } = renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));
      act(() => {
        result.current.emitTokenMove('token-1', 3, 4);
      });
      expect(mockSocketEmit).not.toHaveBeenCalledWith(
        PLAY_AREA_EVENTS.TOKEN_MOVE,
        expect.anything(),
      );
    });

    it('emits after the debounce delay with the latest position', () => {
      const { result } = renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));
      act(() => {
        result.current.emitTokenMove('token-1', 1, 2);
        result.current.emitTokenMove('token-1', 3, 4); // latest
        vi.advanceTimersByTime(SOCKET_TOKEN_MOVE_DEBOUNCE_MS);
      });
      expect(mockSocketEmit).toHaveBeenCalledWith(PLAY_AREA_EVENTS.TOKEN_MOVE, {
        tokenId: 'token-1',
        x: 3,
        y: 4,
        campaignId: 'campaign-1',
      });
    });

    it('collapses multiple rapid moves into one emit', () => {
      const { result } = renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.emitTokenMove('token-1', i, i);
        }
        vi.advanceTimersByTime(SOCKET_TOKEN_MOVE_DEBOUNCE_MS);
      });
      const tokenMoveCalls = mockSocketEmit.mock.calls.filter(
        ([event]) => event === PLAY_AREA_EVENTS.TOKEN_MOVE,
      );
      expect(tokenMoveCalls).toHaveLength(1);
      expect(tokenMoveCalls[0][1]).toMatchObject({ x: 9, y: 9 });
    });

    it('cancels pending emit on unmount', () => {
      const { result, unmount } = renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));
      act(() => {
        result.current.emitTokenMove('token-1', 1, 2);
        unmount();
        vi.advanceTimersByTime(SOCKET_TOKEN_MOVE_DEBOUNCE_MS);
      });
      const tokenMoveCalls = mockSocketEmit.mock.calls.filter(
        ([event]) => event === PLAY_AREA_EVENTS.TOKEN_MOVE,
      );
      expect(tokenMoveCalls).toHaveLength(0);
    });
  });

  describe('callback refs', () => {
    it('calls onTokenMoved when token:moved event fires', () => {
      const onTokenMoved = vi.fn();
      renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1', onTokenMoved }));
      const payload = { tokenId: 'token-1', x: 3, y: 4, campaignId: 'campaign-1', userId: 'u1' };
      triggerSocketEvent(PLAY_AREA_EVENTS.TOKEN_MOVED, payload);
      expect(onTokenMoved).toHaveBeenCalledWith(payload);
    });

    it('calls onUserJoined when user:joined event fires', () => {
      const onUserJoined = vi.fn();
      renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1', onUserJoined }));
      const payload = { userId: 'u2', username: 'Alice', campaignId: 'campaign-1' };
      triggerSocketEvent(PLAY_AREA_EVENTS.USER_JOINED, payload);
      expect(onUserJoined).toHaveBeenCalledWith(payload);
    });

    it('calls onUserLeft when user:left event fires', () => {
      const onUserLeft = vi.fn();
      renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1', onUserLeft }));
      const payload = { userId: 'u2', username: 'Alice', campaignId: 'campaign-1' };
      triggerSocketEvent(PLAY_AREA_EVENTS.USER_LEFT, payload);
      expect(onUserLeft).toHaveBeenCalledWith(payload);
    });

    it('routes aura:updated through onTokenUpdated', () => {
      const onTokenUpdated = vi.fn();
      renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1', onTokenUpdated }));
      const payload = { token: { id: 'token-1' }, campaignId: 'campaign-1' };
      triggerSocketEvent(AURA_EVENTS.AURA_UPDATED, payload);
      expect(onTokenUpdated).toHaveBeenCalledWith(payload);
    });

    it('uses the latest callback ref without recreating the socket', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const { rerender } = renderHook(
        ({ cb }) => usePlayAreaSocket({ campaignId: 'campaign-1', onTokenMoved: cb }),
        { initialProps: { cb: callback1 } },
      );

      const createCallCount = (mockedIo as ReturnType<typeof vi.fn>).mock.calls.length;

      rerender({ cb: callback2 });

      // Socket should NOT have been recreated
      expect((mockedIo as ReturnType<typeof vi.fn>).mock.calls.length).toBe(createCallCount);

      const payload = { tokenId: 'token-1', x: 1, y: 2, campaignId: 'campaign-1', userId: 'u1' };
      triggerSocketEvent(PLAY_AREA_EVENTS.TOKEN_MOVED, payload);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith(payload);
    });

    it('calls onInitiativeUpdated when initiative state changes', () => {
      const onInitiativeUpdated = vi.fn();
      renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1', onInitiativeUpdated }));
      const payload = {
        state: {
          campaignId: 'campaign-1',
          active: true,
          activeTokenId: 'token-1',
          round: 1,
          turnIndex: 0,
          order: [],
        },
      };

      triggerSocketEvent(INITIATIVE_EVENTS.INITIATIVE_UPDATED, payload);

      expect(onInitiativeUpdated).toHaveBeenCalledWith(payload);
    });
  });

  describe('initiative emits', () => {
    it('emits initiative:start with optional token ids', () => {
      const { result } = renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));

      act(() => {
        result.current.emitInitiativeStart(['token-1', 'token-2']);
      });

      expect(mockSocketEmit).toHaveBeenCalledWith(INITIATIVE_EVENTS.INITIATIVE_START, {
        campaignId: 'campaign-1',
        tokenIds: ['token-1', 'token-2'],
      });
    });

    it('emits initiative:advance for the current campaign', () => {
      const { result } = renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));

      act(() => {
        result.current.emitInitiativeAdvance();
      });

      expect(mockSocketEmit).toHaveBeenCalledWith(INITIATIVE_EVENTS.INITIATIVE_ADVANCE, {
        campaignId: 'campaign-1',
      });
    });

    it('emits initiative:end for the current campaign', () => {
      const { result } = renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));

      act(() => {
        result.current.emitInitiativeEnd();
      });

      expect(mockSocketEmit).toHaveBeenCalledWith(INITIATIVE_EVENTS.INITIATIVE_END, {
        campaignId: 'campaign-1',
      });
    });

    it('emits initiative:reorder with the requested order', () => {
      const { result } = renderHook(() => usePlayAreaSocket({ campaignId: 'campaign-1' }));

      act(() => {
        result.current.emitInitiativeReorder(['token-2', 'token-1']);
      });

      expect(mockSocketEmit).toHaveBeenCalledWith(INITIATIVE_EVENTS.INITIATIVE_REORDER, {
        campaignId: 'campaign-1',
        tokenIds: ['token-2', 'token-1'],
      });
    });
  });
});
