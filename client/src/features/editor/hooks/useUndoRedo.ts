import { useCallback, useEffect, useMemo, useRef } from 'react';

export interface UndoableCommand {
  execute: () => void | Promise<void>;
  undo: () => void | Promise<void>;
}

export interface UndoHistory {
  /** Execute a command now and record it. */
  push: (command: UndoableCommand) => void;
  /**
   * Record an already-applied action. Records made in the same tick become one step;
   * a step whose `mergeKey` matches the previous step within the merge window replaces it.
   */
  record: (command: UndoableCommand, mergeKey?: string) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clear: () => void;
  /** Follow recreate aliases so commands can target an entity that was deleted and restored. */
  resolveId: (id: string) => string;
  aliasId: (oldId: string, newId: string) => void;
}

interface UseUndoRedoOptions {
  /** Bind Cmd+Z / Cmd+Shift+Z on macOS, Ctrl+Z / Ctrl+Y elsewhere. Defaults to true. */
  shortcutsEnabled?: boolean;
}

interface HistoryEntry {
  command: UndoableCommand;
  mergeKey?: string;
}

interface PendingRecord {
  command: UndoableCommand;
  mergeKey?: string;
}

/** Continuous edits (slider drags, arrow-key repeat) inside this window collapse into one step. */
const MERGE_WINDOW_MS = 1000;

const NON_TEXT_INPUT_TYPES = new Set(['button', 'checkbox', 'color', 'radio', 'range', 'submit']);

// Text fields keep the browser's native undo
function isTextEntryTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isMacPlatform(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

function combine(commands: UndoableCommand[]): UndoableCommand {
  return {
    execute: async () => {
      await Promise.all(commands.map((c) => c.execute()));
    },
    undo: async () => {
      await Promise.all(commands.map((c) => c.undo()));
    },
  };
}

/**
 * useUndoRedo — client-side command pattern undo/redo stack.
 *
 * Persistence (API calls) happens in execute/undo, so the hook is agnostic
 * to the persistence strategy. Undo/redo runs are serialized so async commands
 * never interleave.
 */
export function useUndoRedo({ shortcutsEnabled = true }: UseUndoRedoOptions = {}): UndoHistory {
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const pendingRef = useRef<PendingRecord[]>([]);
  // Only the step recorded most recently (not one revealed by undo) may absorb a merge
  const lastRecordedRef = useRef<{ entry: HistoryEntry; at: number } | null>(null);
  const aliasesRef = useRef(new Map<string, string>());
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback((): void => {
    const parts = pendingRef.current;
    if (parts.length === 0) return;
    pendingRef.current = [];
    redoStack.current = [];

    const command = parts.length === 1 ? parts[0].command : combine(parts.map((p) => p.command));
    const keys = parts.map((p) => p.mergeKey);
    const mergeKey = keys.every(Boolean) ? keys.sort().join('|') : undefined;
    const now = Date.now();
    const last = lastRecordedRef.current;
    const top = undoStack.current[undoStack.current.length - 1];

    if (
      mergeKey &&
      last &&
      top === last.entry &&
      top.mergeKey === mergeKey &&
      now - last.at < MERGE_WINDOW_MS
    ) {
      top.command = { execute: command.execute, undo: top.command.undo };
      last.at = now;
      return;
    }

    const entry: HistoryEntry = { command, mergeKey };
    undoStack.current.push(entry);
    lastRecordedRef.current = { entry, at: now };
  }, []);

  const record = useCallback(
    (command: UndoableCommand, mergeKey?: string): void => {
      if (pendingRef.current.length === 0) queueMicrotask(flush);
      pendingRef.current.push({ command, mergeKey });
    },
    [flush],
  );

  const push = useCallback(
    (command: UndoableCommand): void => {
      void command.execute();
      record(command);
    },
    [record],
  );

  const enqueue = useCallback((task: () => Promise<void>): Promise<void> => {
    const run = queueRef.current.then(task).catch((err: unknown) => {
      console.error('[useUndoRedo] Command failed:', err);
    });
    queueRef.current = run;
    return run;
  }, []);

  const undo = useCallback(
    (): Promise<void> =>
      enqueue(async () => {
        flush();
        const entry = undoStack.current.pop();
        if (!entry) return;
        lastRecordedRef.current = null;
        await entry.command.undo();
        redoStack.current.push(entry);
      }),
    [enqueue, flush],
  );

  const redo = useCallback(
    (): Promise<void> =>
      enqueue(async () => {
        flush();
        const entry = redoStack.current.pop();
        if (!entry) return;
        lastRecordedRef.current = null;
        await entry.command.execute();
        undoStack.current.push(entry);
      }),
    [enqueue, flush],
  );

  const clear = useCallback((): void => {
    undoStack.current = [];
    redoStack.current = [];
    pendingRef.current = [];
    lastRecordedRef.current = null;
    aliasesRef.current.clear();
  }, []);

  const resolveId = useCallback((id: string): string => {
    let current = id;
    for (let next = aliasesRef.current.get(current); next; next = aliasesRef.current.get(current)) {
      current = next;
    }
    return current;
  }, []);

  const aliasId = useCallback(
    (oldId: string, newId: string): void => {
      const from = resolveId(oldId);
      if (from !== newId) aliasesRef.current.set(from, newId);
    },
    [resolveId],
  );

  useEffect(() => {
    if (!shortcutsEnabled) return;
    const isMac = isMacPlatform();
    const onKeyDown = (e: KeyboardEvent): void => {
      const modifier = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      if (!modifier || e.altKey || isTextEntryTarget(e.target)) return;
      const key = e.key.toLowerCase();
      // Ctrl+Shift+Z is also kept off-Mac since many Windows/Linux editors accept it
      const isRedo = (key === 'z' && e.shiftKey) || (!isMac && key === 'y' && !e.shiftKey);
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        void undo();
      } else if (isRedo) {
        e.preventDefault();
        void redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcutsEnabled, undo, redo]);

  return useMemo(
    () => ({ push, record, undo, redo, clear, resolveId, aliasId }),
    [push, record, undo, redo, clear, resolveId, aliasId],
  );
}
