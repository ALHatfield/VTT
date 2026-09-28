import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessage, RollResult } from '@vtt/shared';
import { DICE_3D_MAX_CONCURRENT_ROLLS, DICE_3D_REVEAL_TIMEOUT_MS } from '@vtt/shared';

import { use3dDiceReveal } from './use3dDiceReveal';

function makeRollData(overrides: Partial<RollResult> = {}): RollResult {
  return {
    formula: 'd20',
    count: 1,
    sides: 20,
    rolls: [14],
    keptRolls: [14],
    modifier: 0,
    advantage: false,
    disadvantage: false,
    total: 14,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    campaignId: 'camp-1',
    userId: 'user-1',
    username: 'Tester',
    type: 'roll',
    text: '',
    rollData: makeRollData(),
    createdAt: new Date().toISOString(),
    ...overrides,
  } as ChatMessage;
}

describe('use3dDiceReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes non-roll messages straight through', () => {
    const addMessage = vi.fn();
    const { result } = renderHook(() => use3dDiceReveal({ enabled: true, addMessage }));

    const msg = makeMessage({ type: 'chat', rollData: null, text: 'hello' });
    act(() => {
      result.current.handleIncomingMessage(msg);
    });

    expect(addMessage).toHaveBeenCalledWith(msg);
    expect(result.current.pendingRolls).toEqual([]);
  });

  it('passes roll messages through when disabled', () => {
    const addMessage = vi.fn();
    const { result } = renderHook(() => use3dDiceReveal({ enabled: false, addMessage }));

    const msg = makeMessage();
    act(() => {
      result.current.handleIncomingMessage(msg);
    });

    expect(addMessage).toHaveBeenCalledWith(msg);
  });

  it('holds a roll message and exposes it in pendingRolls', () => {
    const addMessage = vi.fn();
    const { result } = renderHook(() => use3dDiceReveal({ enabled: true, addMessage }));

    act(() => {
      result.current.handleIncomingMessage(makeMessage());
    });

    expect(addMessage).not.toHaveBeenCalled();
    expect(result.current.pendingRolls).toEqual([
      {
        rollId: 'msg-1',
        dice: [{ sides: 20, value: 14 }],
        rollerName: 'Tester',
      },
    ]);
  });

  it('reveals the held message when the roll completes', () => {
    const addMessage = vi.fn();
    const { result } = renderHook(() => use3dDiceReveal({ enabled: true, addMessage }));

    const msg = makeMessage();
    act(() => {
      result.current.handleIncomingMessage(msg);
    });
    act(() => {
      result.current.handleRollComplete('msg-1');
    });

    expect(addMessage).toHaveBeenCalledWith(msg);
    expect(result.current.pendingRolls).toEqual([]);
  });

  it('ignores completion callbacks for stale roll ids', () => {
    const addMessage = vi.fn();
    const { result } = renderHook(() => use3dDiceReveal({ enabled: true, addMessage }));

    act(() => {
      result.current.handleIncomingMessage(makeMessage());
    });
    act(() => {
      result.current.handleRollComplete('other-roll');
    });

    expect(addMessage).not.toHaveBeenCalled();
    expect(result.current.pendingRolls).toHaveLength(1);
  });

  it('flushes the held message after the safety timeout', () => {
    const addMessage = vi.fn();
    const { result } = renderHook(() => use3dDiceReveal({ enabled: true, addMessage }));

    const msg = makeMessage();
    act(() => {
      result.current.handleIncomingMessage(msg);
    });
    act(() => {
      vi.advanceTimersByTime(DICE_3D_REVEAL_TIMEOUT_MS);
    });

    expect(addMessage).toHaveBeenCalledWith(msg);
    expect(result.current.pendingRolls).toEqual([]);
  });

  it('animates concurrent rolls from different players side by side', () => {
    const addMessage = vi.fn();
    const { result } = renderHook(() => use3dDiceReveal({ enabled: true, addMessage }));

    const first = makeMessage({ id: 'msg-1', username: 'Alice' });
    const second = makeMessage({ id: 'msg-2', username: 'Bob' });
    act(() => {
      result.current.handleIncomingMessage(first);
    });
    act(() => {
      result.current.handleIncomingMessage(second);
    });

    // Both rolls held and animating — neither revealed yet
    expect(addMessage).not.toHaveBeenCalled();
    expect(result.current.pendingRolls.map((r) => r.rollId)).toEqual(['msg-1', 'msg-2']);
    expect(result.current.pendingRolls.map((r) => r.rollerName)).toEqual(['Alice', 'Bob']);

    // Completing one roll reveals only that message
    act(() => {
      result.current.handleRollComplete('msg-1');
    });
    expect(addMessage).toHaveBeenCalledTimes(1);
    expect(addMessage).toHaveBeenCalledWith(first);
    expect(result.current.pendingRolls.map((r) => r.rollId)).toEqual(['msg-2']);
  });

  it('reveals the oldest held roll when the concurrent-roll cap is reached', () => {
    const addMessage = vi.fn();
    const { result } = renderHook(() => use3dDiceReveal({ enabled: true, addMessage }));

    const messages = Array.from({ length: DICE_3D_MAX_CONCURRENT_ROLLS + 1 }, (_, i) =>
      makeMessage({ id: `msg-${String(i + 1)}` }),
    );
    act(() => {
      for (const msg of messages) result.current.handleIncomingMessage(msg);
    });

    // The oldest was revealed to make room; the rest are still held
    expect(addMessage).toHaveBeenCalledTimes(1);
    expect(addMessage).toHaveBeenCalledWith(messages[0]);
    expect(result.current.pendingRolls).toHaveLength(DICE_3D_MAX_CONCURRENT_ROLLS);
  });

  it('reveals unsupported rolls instantly (d100)', () => {
    const addMessage = vi.fn();
    const { result } = renderHook(() => use3dDiceReveal({ enabled: true, addMessage }));

    const msg = makeMessage({
      rollData: makeRollData({ formula: 'd100', sides: 100, rolls: [42], keptRolls: [42], total: 42 }),
    });
    act(() => {
      result.current.handleIncomingMessage(msg);
    });

    expect(addMessage).toHaveBeenCalledWith(msg);
    expect(result.current.pendingRolls).toEqual([]);
  });

  it('flushes all held messages on unmount', () => {
    const addMessage = vi.fn();
    const { result, unmount } = renderHook(() =>
      use3dDiceReveal({ enabled: true, addMessage }),
    );

    const first = makeMessage({ id: 'msg-1' });
    const second = makeMessage({ id: 'msg-2' });
    act(() => {
      result.current.handleIncomingMessage(first);
      result.current.handleIncomingMessage(second);
    });
    unmount();

    expect(addMessage).toHaveBeenCalledWith(first);
    expect(addMessage).toHaveBeenCalledWith(second);
  });
});
