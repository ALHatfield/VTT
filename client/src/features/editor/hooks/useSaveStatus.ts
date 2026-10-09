// useSaveStatus — Phase 5H
// React binding for the editor save tracker.
import { useCallback, useSyncExternalStore } from 'react';

import type { SaveTracker, SaveTrackerSnapshot } from '../utils/save-tracker';
import { editorSaveTracker } from '../utils/save-tracker';

export interface UseSaveStatusReturn extends SaveTrackerSnapshot {
  retry: () => void;
}

export function useSaveStatus(tracker: SaveTracker = editorSaveTracker): UseSaveStatusReturn {
  const snapshot = useSyncExternalStore(
    useCallback((listener) => tracker.subscribe(listener), [tracker]),
    useCallback(() => tracker.getSnapshot(), [tracker]),
  );
  const retry = useCallback((): void => {
    tracker.retry();
  }, [tracker]);
  return { ...snapshot, retry };
}
