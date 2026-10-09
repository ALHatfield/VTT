// Vision recompute scheduling — Phase PM3
// Trailing throttle: bursts of triggers coalesce into one recompute per interval, and a
// steady stream (e.g. several tokens moving) still produces updates instead of starving
// the way a resettable debounce would.
import type { Server } from 'socket.io';

import { VISION_SYNC_DEBOUNCE_MS } from '@vtt/shared';

import { emitVisionSync } from './vision.service.js';

type VisionTask = () => Promise<void>;

interface ScheduleEntry {
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  /** Set when a trigger arrives while the task is running — reschedule afterwards. */
  dirty: boolean;
}

export interface VisionScheduler {
  schedule(key: string, task: VisionTask): void;
  /** Run as soon as no recompute for `key` is in flight; still never overlaps a running task. */
  runNow(key: string, task: VisionTask): void;
  /** Number of keys with a pending or running recompute. */
  pendingCount(): number;
}

/**
 * All recomputes for one key run strictly one at a time, so broadcasts can never
 * arrive out of order (an older snapshot overwriting a newer one).
 */
export function createVisionScheduler(intervalMs: number): VisionScheduler {
  const entries = new Map<string, ScheduleEntry>();

  const run = (key: string, entry: ScheduleEntry, task: VisionTask): void => {
    entry.timer = null;
    entry.running = true;
    task()
      .catch((err: unknown) => {
        console.error('[play-area vision] recompute error', err);
      })
      .finally(() => {
        entry.running = false;
        if (entry.dirty) {
          entry.dirty = false;
          arm(key, entry, task);
          return;
        }
        entries.delete(key);
      });
  };

  const arm = (key: string, entry: ScheduleEntry, task: VisionTask): void => {
    entry.timer = setTimeout(() => run(key, entry, task), intervalMs);
  };

  return {
    schedule(key, task): void {
      const existing = entries.get(key);
      if (existing) {
        if (existing.running) existing.dirty = true;
        return;
      }
      const entry: ScheduleEntry = { timer: null, running: false, dirty: false };
      entries.set(key, entry);
      arm(key, entry, task);
    },
    runNow(key, task): void {
      const existing = entries.get(key);
      if (existing?.running) {
        existing.dirty = true;
        return;
      }
      if (existing?.timer) clearTimeout(existing.timer);
      const entry = existing ?? { timer: null, running: false, dirty: false };
      entries.set(key, entry);
      run(key, entry, task);
    },
    pendingCount(): number {
      return entries.size;
    },
  };
}

const sceneVisionScheduler = createVisionScheduler(VISION_SYNC_DEBOUNCE_MS);

function sceneTask(io: Server, campaignId: string, sceneId: string): VisionTask {
  return () => emitVisionSync(io, campaignId, sceneId);
}

/** Schedule a throttled, room-wide vision + line-of-sight broadcast for a scene. */
export function scheduleVisionSync(io: Server, campaignId: string, sceneId: string): void {
  sceneVisionScheduler.schedule(`${campaignId}:${sceneId}`, sceneTask(io, campaignId, sceneId));
}

/** Broadcast now (discrete actions like door toggles), serialized with scheduled recomputes. */
export function flushVisionSync(io: Server, campaignId: string, sceneId: string): void {
  sceneVisionScheduler.runNow(`${campaignId}:${sceneId}`, sceneTask(io, campaignId, sceneId));
}
