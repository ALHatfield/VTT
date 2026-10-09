import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createVisionScheduler } from './vision.scheduler.js';

const INTERVAL_MS = 200;

describe('createVisionScheduler (LOS throttling)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('coalesces a burst of triggers into one recompute', async () => {
    const scheduler = createVisionScheduler(INTERVAL_MS);
    const task = vi.fn().mockResolvedValue(undefined);

    for (let i = 0; i < 10; i += 1) scheduler.schedule('scene', task);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(task).toHaveBeenCalledOnce();
    expect(scheduler.pendingCount()).toBe(0);
  });

  it('keeps producing updates under a steady stream instead of starving like a debounce', async () => {
    const scheduler = createVisionScheduler(INTERVAL_MS);
    const task = vi.fn().mockResolvedValue(undefined);

    // One trigger every 50 ms for one second — a resettable debounce would never fire.
    for (let t = 0; t < 1000; t += 50) {
      scheduler.schedule('scene', task);
      await vi.advanceTimersByTimeAsync(50);
    }

    expect(task.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(task.mock.calls.length).toBeLessThanOrEqual(1000 / INTERVAL_MS);
  });

  it('reschedules once when triggered while a recompute is running', async () => {
    const scheduler = createVisionScheduler(INTERVAL_MS);
    let release: () => void = () => undefined;
    const task = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
      .mockResolvedValue(undefined);

    scheduler.schedule('scene', task);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(task).toHaveBeenCalledOnce();

    scheduler.schedule('scene', task);
    scheduler.schedule('scene', task);
    release();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(task).toHaveBeenCalledTimes(2);
    expect(scheduler.pendingCount()).toBe(0);
  });

  it('schedules independent keys separately', async () => {
    const scheduler = createVisionScheduler(INTERVAL_MS);
    const a = vi.fn().mockResolvedValue(undefined);
    const b = vi.fn().mockResolvedValue(undefined);

    scheduler.schedule('scene-a', a);
    scheduler.schedule('scene-b', b);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('runNow fires immediately and cancels a pending throttled run', async () => {
    const scheduler = createVisionScheduler(INTERVAL_MS);
    const task = vi.fn().mockResolvedValue(undefined);

    scheduler.schedule('scene', task);
    scheduler.runNow('scene', task);
    expect(task).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 2);
    expect(task).toHaveBeenCalledOnce();
    expect(scheduler.pendingCount()).toBe(0);
  });

  it('runNow never overlaps a running recompute (broadcasts stay ordered)', async () => {
    const scheduler = createVisionScheduler(INTERVAL_MS);
    let active = 0;
    let maxActive = 0;
    const releases: (() => void)[] = [];
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          releases.push(() => {
            active -= 1;
            resolve();
          });
        }),
    );

    scheduler.runNow('scene', task);
    scheduler.runNow('scene', task);
    expect(task).toHaveBeenCalledOnce();

    releases.shift()?.();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(task).toHaveBeenCalledTimes(2);
    releases.shift()?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(maxActive).toBe(1);
    expect(scheduler.pendingCount()).toBe(0);
  });

  it('logs task errors and frees the key', async () => {
    const scheduler = createVisionScheduler(INTERVAL_MS);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    scheduler.schedule('scene', () => Promise.reject(new Error('boom')));
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(consoleError).toHaveBeenCalled();
    expect(scheduler.pendingCount()).toBe(0);
  });
});
