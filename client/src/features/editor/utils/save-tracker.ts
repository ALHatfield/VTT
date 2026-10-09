// Editor save tracker — Phase 5H
// Aggregates pending (debounced, unsent) and in-flight writes across all editor
// hooks so the SaveStatusIndicator can show one Saving…/Saved/Error state.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveTrackerSnapshot {
  pendingCount: number;
  inFlightCount: number;
  failedCount: number;
  /** Successful writes since reset — drives edit-triggered thumbnail capture. */
  savedCount: number;
  status: SaveStatus;
}

type Listener = () => void;
type WriteOp = () => Promise<unknown>;

interface FailedOp {
  op: WriteOp;
  key: string | undefined;
}

export class SaveTracker {
  private readonly pendingKeys = new Set<string>();
  private inFlightCount = 0;
  private failedOps: FailedOp[] = [];
  private savedCount = 0;
  private readonly listeners = new Set<Listener>();
  private snapshot: SaveTrackerSnapshot = {
    pendingCount: 0,
    inFlightCount: 0,
    failedCount: 0,
    savedCount: 0,
    status: 'idle',
  };

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): SaveTrackerSnapshot {
    return this.snapshot;
  }

  /** Mark a debounced edit as awaiting send (true) or sent/cancelled (false). */
  setPending(key: string, pending: boolean): void {
    const had = this.pendingKeys.has(key);
    if (pending === had) return;
    if (pending) this.pendingKeys.add(key);
    else this.pendingKeys.delete(key);
    this.publish();
  }

  /**
   * Run a write, tracking it as in-flight. Failed ops are kept for retry();
   * when a key is given, a newer write for the same key supersedes any stored
   * failure so retry never regresses fresher data. Rethrows so callers keep
   * their own error handling.
   */
  async track<T>(op: () => Promise<T>, key?: string): Promise<T> {
    this.inFlightCount++;
    this.publish();
    try {
      const result = await op();
      this.savedCount++;
      if (key !== undefined) {
        this.failedOps = this.failedOps.filter((f) => f.key !== key);
      }
      return result;
    } catch (err: unknown) {
      if (key !== undefined) {
        this.failedOps = this.failedOps.filter((f) => f.key !== key);
      }
      this.failedOps.push({ op, key });
      throw err;
    } finally {
      this.inFlightCount--;
      this.publish();
    }
  }

  /** Re-run every failed write. Errors are re-captured by track(). */
  retry(): void {
    const ops = this.failedOps;
    this.failedOps = [];
    this.publish();
    for (const { op, key } of ops) {
      void this.track(op, key).catch(() => undefined);
    }
  }

  /** Drop all state — used when leaving the campaign and between tests. */
  reset(): void {
    this.pendingKeys.clear();
    this.inFlightCount = 0;
    this.failedOps = [];
    this.savedCount = 0;
    this.publish();
  }

  private publish(): void {
    const pendingCount = this.pendingKeys.size;
    const failedCount = this.failedOps.length;
    let status: SaveStatus;
    if (failedCount > 0) status = 'error';
    else if (pendingCount + this.inFlightCount > 0) status = 'saving';
    else status = this.savedCount > 0 ? 'saved' : 'idle';

    this.snapshot = {
      pendingCount,
      inFlightCount: this.inFlightCount,
      failedCount,
      savedCount: this.savedCount,
      status,
    };
    for (const listener of this.listeners) listener();
  }
}

/** Shared tracker instrumented by every editor persistence hook. */
export const editorSaveTracker = new SaveTracker();
