import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUndoRedo } from './useUndoRedo';

describe('useUndoRedo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('push executes the command immediately', () => {
    const { result } = renderHook(() => useUndoRedo());
    const execute = vi.fn();
    const undo = vi.fn();

    act(() => {
      result.current.push({ execute, undo });
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
  });

  it('undo calls undo function of last command', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const execute = vi.fn();
    const undo = vi.fn();

    act(() => {
      result.current.push({ execute, undo });
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('redo re-executes the last undone command', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const execute = vi.fn();
    const undo = vi.fn();

    act(() => {
      result.current.push({ execute, undo });
    });
    await act(async () => {
      await result.current.undo();
    });
    await act(async () => {
      await result.current.redo();
    });

    // execute was called on push AND on redo
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('push invalidates the redo stack', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const cmd1 = { execute: vi.fn(), undo: vi.fn() };
    const cmd2 = { execute: vi.fn(), undo: vi.fn() };

    act(() => { result.current.push(cmd1); });
    await act(async () => { await result.current.undo(); });
    // Pushing a new command should clear the redo stack
    act(() => { result.current.push(cmd2); });
    // redo should have nothing to do
    await act(async () => { await result.current.redo(); });
    expect(cmd1.execute).toHaveBeenCalledTimes(1); // only the initial push
  });

  it('undo on empty stack does nothing', async () => {
    const { result } = renderHook(() => useUndoRedo());
    await expect(
      act(async () => { await result.current.undo(); }),
    ).resolves.not.toThrow();
  });

  it('clear empties both stacks', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const cmd = { execute: vi.fn(), undo: vi.fn() };
    act(() => { result.current.push(cmd); });
    act(() => { result.current.clear(); });
    // After clear, undo should do nothing
    await act(async () => { await result.current.undo(); });
    expect(cmd.undo).not.toHaveBeenCalled();
  });

  it('registers Ctrl+Z keyboard shortcut for undo', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const cmd = { execute: vi.fn(), undo: vi.fn() };
    act(() => { result.current.push(cmd); });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });

    expect(cmd.undo).toHaveBeenCalledTimes(1);
  });

  it('registers Ctrl+Shift+Z keyboard shortcut for redo', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const cmd = { execute: vi.fn(), undo: vi.fn() };
    act(() => { result.current.push(cmd); });
    await act(async () => { await result.current.undo(); });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true }));
    });

    expect(cmd.execute).toHaveBeenCalledTimes(2); // initial + redo
  });
});
