// save-tracker tests — Phase 5H
import { describe, expect, it, vi } from 'vitest';

import { SaveTracker } from './save-tracker';

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void } {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SaveTracker', () => {
  it('starts idle', () => {
    const tracker = new SaveTracker();
    expect(tracker.getSnapshot()).toEqual({
      pendingCount: 0,
      inFlightCount: 0,
      failedCount: 0,
      savedCount: 0,
      status: 'idle',
    });
  });

  it('reports saving while a pending debounce is registered', () => {
    const tracker = new SaveTracker();
    tracker.setPending('tile:a', true);
    tracker.setPending('light:b', true);
    expect(tracker.getSnapshot().pendingCount).toBe(2);
    expect(tracker.getSnapshot().status).toBe('saving');

    tracker.setPending('tile:a', false);
    tracker.setPending('light:b', false);
    expect(tracker.getSnapshot().status).toBe('idle');
  });

  it('deduplicates pending keys', () => {
    const tracker = new SaveTracker();
    tracker.setPending('tile:a', true);
    tracker.setPending('tile:a', true);
    expect(tracker.getSnapshot().pendingCount).toBe(1);
  });

  it('tracks in-flight writes and transitions to saved on success', async () => {
    const tracker = new SaveTracker();
    const { promise, resolve } = deferred();

    const tracked = tracker.track(() => promise);
    expect(tracker.getSnapshot()).toMatchObject({ inFlightCount: 1, status: 'saving' });

    resolve();
    await tracked;
    expect(tracker.getSnapshot()).toMatchObject({ inFlightCount: 0, status: 'saved' });
  });

  it('aggregates pending and in-flight writes across sources', async () => {
    const tracker = new SaveTracker();
    const { promise, resolve } = deferred();

    tracker.setPending('tile:a', true);
    const tracked = tracker.track(() => promise);
    expect(tracker.getSnapshot()).toMatchObject({
      pendingCount: 1,
      inFlightCount: 1,
      status: 'saving',
    });

    tracker.setPending('tile:a', false);
    expect(tracker.getSnapshot().status).toBe('saving');
    resolve();
    await tracked;
    expect(tracker.getSnapshot().status).toBe('saved');
  });

  it('captures failed writes, reports error, and rethrows to the caller', async () => {
    const tracker = new SaveTracker();
    await expect(
      tracker.track(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(tracker.getSnapshot()).toMatchObject({ failedCount: 1, status: 'error' });
  });

  it('retry re-runs failed writes and clears the error on success', async () => {
    const tracker = new SaveTracker();
    let failOnce = true;
    const op = (): Promise<void> => {
      if (failOnce) {
        failOnce = false;
        return Promise.reject(new Error('boom'));
      }
      return Promise.resolve();
    };
    await tracker.track(op).catch(() => undefined);
    expect(tracker.getSnapshot().status).toBe('error');

    tracker.retry();
    await Promise.resolve();
    await Promise.resolve();
    expect(tracker.getSnapshot()).toMatchObject({ failedCount: 0, status: 'saved' });
  });

  it('a newer keyed write supersedes a stored failure so retry cannot regress data', async () => {
    const tracker = new SaveTracker();
    const staleOp = vi.fn().mockRejectedValue(new Error('boom'));
    await tracker.track(staleOp, 'tile:a').catch(() => undefined);
    expect(tracker.getSnapshot().failedCount).toBe(1);

    // A fresh write for the same entity succeeds — the stale failure is dropped
    await tracker.track(() => Promise.resolve(), 'tile:a');
    expect(tracker.getSnapshot()).toMatchObject({ failedCount: 0, status: 'saved' });

    tracker.retry();
    await Promise.resolve();
    expect(staleOp).toHaveBeenCalledTimes(1);
  });

  it('counts successful writes for edit-triggered consumers', async () => {
    const tracker = new SaveTracker();
    await tracker.track(() => Promise.resolve());
    await tracker.track(() => Promise.resolve());
    expect(tracker.getSnapshot().savedCount).toBe(2);
  });

  it('notifies subscribers on every change and supports unsubscribe', () => {
    const tracker = new SaveTracker();
    let notified = 0;
    const unsubscribe = tracker.subscribe(() => {
      notified++;
    });
    tracker.setPending('tile:a', true);
    expect(notified).toBe(1);
    unsubscribe();
    tracker.setPending('tile:a', false);
    expect(notified).toBe(1);
  });

  it('reset drops all state', async () => {
    const tracker = new SaveTracker();
    tracker.setPending('tile:a', true);
    await tracker.track(() => Promise.reject(new Error('boom'))).catch(() => undefined);
    tracker.reset();
    expect(tracker.getSnapshot()).toEqual({
      pendingCount: 0,
      inFlightCount: 0,
      failedCount: 0,
      savedCount: 0,
      status: 'idle',
    });
  });
});
