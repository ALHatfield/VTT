import { useCallback, useEffect, useRef } from 'react';

export interface UndoableCommand {
  execute: () => void | Promise<void>;
  undo: () => void | Promise<void>;
}

/**
 * useUndoRedo — client-side command pattern undo/redo stack.
 *
 * Persistence (API calls) happens in execute/undo, so the hook is agnostic
 * to the persistence strategy. The stack is kept as a ref to avoid triggering
 * re-renders on every action.
 *
 * Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
 */
export function useUndoRedo() {
  const undoStack = useRef<UndoableCommand[]>([]);
  const redoStack = useRef<UndoableCommand[]>([]);

  const push = useCallback((command: UndoableCommand) => {
    // Execute immediately
    void command.execute();
    undoStack.current.push(command);
    // Invalidate redo stack on new action
    redoStack.current = [];
  }, []);

  const undo = useCallback(async () => {
    const command = undoStack.current.pop();
    if (!command) return;
    await command.undo();
    redoStack.current.push(command);
  }, []);

  const redo = useCallback(async () => {
    const command = redoStack.current.pop();
    if (!command) return;
    await command.execute();
    undoStack.current.push(command);
  }, []);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
  }, []);

  /**
   * Record an already-performed action onto the undo stack without executing it.
   * Use this when the action has already been applied (e.g. async API calls).
   */
  const record = useCallback((command: UndoableCommand) => {
    undoStack.current.push(command);
    redoStack.current = [];
  }, []);

  // Keyboard shortcut binding
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        void undo();
      } else if ((e.key === 'Z' || (e.key === 'z' && e.shiftKey)) && ctrl) {
        e.preventDefault();
        void redo();
      } else if (e.key === 'y' && ctrl) {
        e.preventDefault();
        void redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  return { push, record, undo, redo, clear };
}
