// useSceneThumbnail tests — Phase 5H
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SCENE_THUMBNAIL_CAPTURE_DEBOUNCE_MS, SCENE_THUMBNAIL_WIDTH } from '@vtt/shared';

import { useSceneThumbnail } from './useSceneThumbnail';

describe('useSceneThumbnail', () => {
  const blob = new Blob(['img'], { type: 'image/webp' });
  let extractSceneSnapshot: ReturnType<typeof vi.fn>;
  let uploadThumbnail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    extractSceneSnapshot = vi.fn().mockResolvedValue(blob);
    uploadThumbnail = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(overrides: Partial<Parameters<typeof useSceneThumbnail>[0]> = {}) {
    const initial = {
      canvasManager: { extractSceneSnapshot },
      sceneId: 's-1',
      enabled: true,
      contentVersion: 0 as unknown,
      uploadThumbnail,
      ...overrides,
    };
    return renderHook((props: Parameters<typeof useSceneThumbnail>[0]) => useSceneThumbnail(props), {
      initialProps: initial,
    });
  }

  it('captures and uploads after the debounce when content changes', async () => {
    const { rerender } = setup();
    rerender({
      canvasManager: { extractSceneSnapshot },
      sceneId: 's-1',
      enabled: true,
      contentVersion: 1,
      uploadThumbnail,
    });

    expect(extractSceneSnapshot).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(SCENE_THUMBNAIL_CAPTURE_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(extractSceneSnapshot).toHaveBeenCalledWith(SCENE_THUMBNAIL_WIDTH);
    expect(uploadThumbnail).toHaveBeenCalledWith('s-1', blob);
  });

  it('resets the debounce on consecutive edits', async () => {
    const { rerender } = setup();
    for (const version of [1, 2, 3]) {
      rerender({
        canvasManager: { extractSceneSnapshot },
        sceneId: 's-1',
        enabled: true,
        contentVersion: version,
        uploadThumbnail,
      });
      await act(async () => {
        vi.advanceTimersByTime(SCENE_THUMBNAIL_CAPTURE_DEBOUNCE_MS / 2);
      });
    }
    expect(uploadThumbnail).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(SCENE_THUMBNAIL_CAPTURE_DEBOUNCE_MS);
      await Promise.resolve();
    });
    expect(uploadThumbnail).toHaveBeenCalledTimes(1);
  });

  it('captureNow uploads immediately and cancels the scheduled capture', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.captureNow();
    });
    expect(uploadThumbnail).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(SCENE_THUMBNAIL_CAPTURE_DEBOUNCE_MS * 2);
      await Promise.resolve();
    });
    expect(uploadThumbnail).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', async () => {
    const { result } = setup({ enabled: false });
    await act(async () => {
      await result.current.captureNow();
      vi.advanceTimersByTime(SCENE_THUMBNAIL_CAPTURE_DEBOUNCE_MS * 2);
      await Promise.resolve();
    });
    expect(extractSceneSnapshot).not.toHaveBeenCalled();
    expect(uploadThumbnail).not.toHaveBeenCalled();
  });

  it('skips the upload when extraction returns null (no map loaded)', async () => {
    extractSceneSnapshot.mockResolvedValue(null);
    const { result } = setup();
    await act(async () => {
      await result.current.captureNow();
    });
    expect(uploadThumbnail).not.toHaveBeenCalled();
  });

  it('logs and swallows upload failures (thumbnails are best-effort)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    uploadThumbnail.mockRejectedValue(new Error('500'));
    const { result } = setup();
    await act(async () => {
      await result.current.captureNow();
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
