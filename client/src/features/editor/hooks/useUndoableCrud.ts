// useUndoableCrud — wraps an entity's create/update/delete so each call is recorded
// on the editor undo history. Deleted entities are recreated with a new server id,
// which the history aliases so older steps keep targeting the right entity.
import { useCallback, useMemo, useRef } from 'react';

import type { UndoHistory } from './useUndoRedo';

interface UseUndoableCrudOptions<T extends { id: string }, C, U extends object> {
  history: UndoHistory;
  items: readonly T[];
  /** Namespaces merge keys so edits to different entity types never coalesce. */
  kind: string;
  create: (payload: C) => Promise<T | null>;
  update: (id: string, patch: U) => void | Promise<void>;
  remove: (id: string) => Promise<void>;
  removeAll?: () => Promise<void>;
  /** Payload that recreates an entity with all of its editable properties. */
  toCreatePayload: (item: T) => C;
}

export interface UndoableCrud<T, C, U> {
  create: (payload: C) => Promise<T | null>;
  update: (id: string, patch: U) => void;
  remove: (id: string) => Promise<void>;
  removeAll: () => Promise<void>;
}

function pickCurrent<U extends object>(item: object, patch: U): U {
  const source = item as Record<string, unknown>;
  const current: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) current[key] = source[key];
  return current as U;
}

function isNoOp(item: object, patch: object): boolean {
  const source = item as Record<string, unknown>;
  return Object.entries(patch).every(([key, value]) => source[key] === value);
}

export function useUndoableCrud<T extends { id: string }, C, U extends object>(
  options: UseUndoableCrudOptions<T, C, U>,
): UndoableCrud<T, C, U> {
  const { history, kind } = options;
  const { record, resolveId, aliasId } = history;
  // Read at call time so the returned callbacks stay stable across renders
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const findItem = useCallback(
    (id: string): T | undefined => optionsRef.current.items.find((item) => item.id === id),
    [],
  );

  const recreate = useCallback(
    async (item: T): Promise<void> => {
      const { create, toCreatePayload } = optionsRef.current;
      const created = await create(toCreatePayload(item));
      if (created) aliasId(item.id, created.id);
    },
    [aliasId],
  );

  const create = useCallback(
    async (payload: C): Promise<T | null> => {
      const created = await optionsRef.current.create(payload);
      if (!created) return null;
      record({
        execute: () => recreate(created),
        undo: () => optionsRef.current.remove(resolveId(created.id)),
      });
      return created;
    },
    [record, recreate, resolveId],
  );

  const update = useCallback(
    (id: string, patch: U): void => {
      const item = findItem(id);
      void optionsRef.current.update(id, patch);
      if (!item || isNoOp(item, patch)) return;
      const previous = pickCurrent(item, patch);
      record(
        {
          execute: () => optionsRef.current.update(resolveId(id), patch),
          undo: () => optionsRef.current.update(resolveId(id), previous),
        },
        `${kind}:${id}:${Object.keys(patch).sort().join(',')}`,
      );
    },
    [findItem, kind, record, resolveId],
  );

  const remove = useCallback(
    (id: string): Promise<void> => {
      const item = findItem(id);
      if (item) {
        record({
          execute: () => optionsRef.current.remove(resolveId(item.id)),
          undo: () => recreate(item),
        });
      }
      return optionsRef.current.remove(id);
    },
    [findItem, record, recreate, resolveId],
  );

  const removeAll = useCallback((): Promise<void> => {
    const { items, removeAll: removeAllItems } = optionsRef.current;
    if (!removeAllItems) return Promise.resolve();
    const snapshot = [...items];
    if (snapshot.length > 0) {
      record({
        execute: () => optionsRef.current.removeAll?.(),
        undo: async () => {
          await Promise.all(snapshot.map(recreate));
        },
      });
    }
    return removeAllItems();
  }, [record, recreate]);

  return useMemo(
    () => ({ create, update, remove, removeAll }),
    [create, update, remove, removeAll],
  );
}
