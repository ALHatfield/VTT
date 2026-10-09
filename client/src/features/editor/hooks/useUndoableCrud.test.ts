import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useUndoableCrud } from './useUndoableCrud';
import { useUndoRedo } from './useUndoRedo';

interface Item {
  id: string;
  x: number;
}

function setup(initial: Item[]) {
  let items = [...initial];
  let nextId = 1;
  const create = vi.fn(async (payload: { x: number }): Promise<Item> => {
    const item = { id: `new-${nextId++}`, ...payload };
    items = [...items, item];
    return item;
  });
  const update = vi.fn((id: string, patch: Partial<Item>): void => {
    items = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
  });
  const remove = vi.fn(async (id: string): Promise<void> => {
    items = items.filter((i) => i.id !== id);
  });

  const hook = renderHook(() => {
    const history = useUndoRedo({ shortcutsEnabled: false });
    const crud = useUndoableCrud({
      history,
      items,
      kind: 'item',
      create,
      update,
      remove,
      toCreatePayload: ({ x }: Item) => ({ x }),
    });
    return { history, crud };
  });
  const settle = async (): Promise<void> => {
    await act(async () => {
      await Promise.resolve();
    });
    hook.rerender();
  };
  return { hook, create, update, remove, settle, getItems: () => items };
}

describe('useUndoableCrud', () => {
  it('undoes and redoes an update', async () => {
    const { hook, update, settle } = setup([{ id: 'a', x: 0 }]);
    act(() => hook.result.current.crud.update('a', { x: 10 }));
    await settle();

    await act(() => hook.result.current.history.undo());
    expect(update).toHaveBeenLastCalledWith('a', { x: 0 });
    await act(() => hook.result.current.history.redo());
    expect(update).toHaveBeenLastCalledWith('a', { x: 10 });
  });

  it('does not record an update that changes nothing', async () => {
    const { hook, update, settle } = setup([{ id: 'a', x: 5 }]);
    act(() => hook.result.current.crud.update('a', { x: 5 }));
    await settle();

    await act(() => hook.result.current.history.undo());
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('recreates a deleted item on undo and targets the new id afterwards', async () => {
    const { hook, create, remove, settle, getItems } = setup([{ id: 'a', x: 3 }]);
    await act(() => hook.result.current.crud.remove('a'));
    await settle();

    await act(() => hook.result.current.history.undo());
    expect(create).toHaveBeenCalledWith({ x: 3 });
    expect(getItems()).toEqual([{ id: 'new-1', x: 3 }]);

    await act(() => hook.result.current.history.redo());
    expect(remove).toHaveBeenLastCalledWith('new-1');
    expect(getItems()).toEqual([]);
  });

  it('removes a created item on undo and recreates it on redo', async () => {
    const { hook, remove, settle, getItems } = setup([]);
    await act(async () => {
      await hook.result.current.crud.create({ x: 7 });
    });
    await settle();

    await act(() => hook.result.current.history.undo());
    expect(remove).toHaveBeenCalledWith('new-1');
    await act(() => hook.result.current.history.redo());
    expect(getItems()).toEqual([{ id: 'new-2', x: 7 }]);

    await act(() => hook.result.current.history.undo());
    expect(remove).toHaveBeenLastCalledWith('new-2');
  });
});
