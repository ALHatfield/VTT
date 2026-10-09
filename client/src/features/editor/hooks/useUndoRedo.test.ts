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

  it('registers Ctrl+Y for redo on Windows/Linux and ignores Cmd', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const cmd = { execute: vi.fn(), undo: vi.fn() };
    act(() => { result.current.push(cmd); });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
    });
    expect(cmd.undo).not.toHaveBeenCalled();

    await act(async () => { await result.current.undo(); });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }));
    });
    expect(cmd.execute).toHaveBeenCalledTimes(2);
  });

  it('uses Cmd+Z / Cmd+Shift+Z on macOS and ignores Ctrl and Cmd+Y', async () => {
    const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { result } = renderHook(() => useUndoRedo());
    const cmd = { execute: vi.fn(), undo: vi.fn() };
    act(() => { result.current.push(cmd); });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });
    expect(cmd.undo).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
    });
    expect(cmd.undo).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', metaKey: true }));
    });
    expect(cmd.execute).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true }));
    });
    expect(cmd.execute).toHaveBeenCalledTimes(2);
    platform.mockRestore();
  });

  it('groups records made in the same tick into one step', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const a = { execute: vi.fn(), undo: vi.fn() };
    const b = { execute: vi.fn(), undo: vi.fn() };
    act(() => {
      result.current.record(a);
      result.current.record(b);
    });

    await act(async () => {
      await result.current.undo();
    });
    expect(a.undo).toHaveBeenCalledTimes(1);
    expect(b.undo).toHaveBeenCalledTimes(1);
  });

  it('merges consecutive records with the same key inside the merge window', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const first = { execute: vi.fn(), undo: vi.fn() };
    const second = { execute: vi.fn(), undo: vi.fn() };
    const older = { execute: vi.fn(), undo: vi.fn() };
    await act(async () => {
      result.current.record(older);
      await Promise.resolve();
      result.current.record(first, 'tile:1:x');
      await Promise.resolve();
      vi.advanceTimersByTime(200);
      result.current.record(second, 'tile:1:x');
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.undo();
    });
    expect(first.undo).toHaveBeenCalledTimes(1);
    expect(second.undo).not.toHaveBeenCalled();
    expect(older.undo).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.redo();
    });
    expect(second.execute).toHaveBeenCalledTimes(1);
    expect(first.execute).not.toHaveBeenCalled();
  });

  it('does not merge once the merge window has passed', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const first = { execute: vi.fn(), undo: vi.fn() };
    const second = { execute: vi.fn(), undo: vi.fn() };
    await act(async () => {
      result.current.record(first, 'k');
      await Promise.resolve();
      vi.advanceTimersByTime(5000);
      result.current.record(second, 'k');
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.undo();
    });
    expect(second.undo).toHaveBeenCalledTimes(1);
    expect(first.undo).not.toHaveBeenCalled();
  });

  it('resolves chained id aliases', () => {
    const { result } = renderHook(() => useUndoRedo());
    act(() => {
      result.current.aliasId('a', 'b');
      result.current.aliasId('a', 'c');
    });
    expect(result.current.resolveId('a')).toBe('c');
    expect(result.current.resolveId('b')).toBe('c');
  });

  it('leaves Ctrl+Z to text inputs', async () => {
    const { result } = renderHook(() => useUndoRedo());
    const cmd = { execute: vi.fn(), undo: vi.fn() };
    act(() => { result.current.push(cmd); });
    const input = document.createElement('input');
    document.body.appendChild(input);

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    });

    expect(cmd.undo).not.toHaveBeenCalled();
    input.remove();
  });

  it('ignores shortcuts when disabled', async () => {
    const { result } = renderHook(() => useUndoRedo({ shortcutsEnabled: false }));
    const cmd = { execute: vi.fn(), undo: vi.fn() };
    act(() => { result.current.push(cmd); });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });

    expect(cmd.undo).not.toHaveBeenCalled();
  });
});
