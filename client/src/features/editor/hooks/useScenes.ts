// useScenes — Phase 5H
// DM-only scene library CRUD: list, create, rename/update, delete, duplicate,
// reorder, and thumbnail upload. List state applies optimistic reorders and
// re-syncs from the server on failure.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SceneCreatePayload, SceneSummary, SceneUpdatePayload } from '@vtt/shared';

export interface UseScenesReturn {
  scenes: SceneSummary[];
  isLoading: boolean;
  error: string | null;
  createScene: (payload: SceneCreatePayload) => Promise<SceneSummary | null>;
  updateScene: (sceneId: string, payload: SceneUpdatePayload) => Promise<SceneSummary | null>;
  deleteScene: (sceneId: string) => Promise<boolean>;
  duplicateScene: (sceneId: string) => Promise<SceneSummary | null>;
  reorderScenes: (sceneIds: string[]) => Promise<void>;
  uploadThumbnail: (sceneId: string, blob: Blob) => Promise<void>;
  refresh: () => Promise<void>;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return body.error?.message ?? `${fallback}: HTTP ${res.status}`;
}

export function useScenes(campaignId: string | undefined, enabled: boolean): UseScenesReturn {
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Discards responses from superseded fetches
  const fetchSeqRef = useRef(0);

  const baseUrl = enabled && campaignId ? `/api/campaigns/${campaignId}/scenes` : null;

  const refresh = useCallback(async (): Promise<void> => {
    const seq = ++fetchSeqRef.current;
    if (!baseUrl) {
      setScenes([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(baseUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to load scenes'));
      const body = (await res.json()) as { data: SceneSummary[] };
      if (seq !== fetchSeqRef.current) return;
      setScenes(body.data);
      setError(null);
    } catch (err: unknown) {
      if (seq === fetchSeqRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load scenes');
      }
    } finally {
      if (seq === fetchSeqRef.current) setIsLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    setScenes([]);
    void refresh();
  }, [refresh]);

  const createScene = useCallback(
    async (payload: SceneCreatePayload): Promise<SceneSummary | null> => {
      if (!baseUrl) return null;
      try {
        const res = await fetch(baseUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to create scene'));
        const { data } = (await res.json()) as { data: SceneSummary };
        setScenes((prev) => [...prev, data]);
        setError(null);
        return data;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to create scene');
        return null;
      }
    },
    [baseUrl],
  );

  const updateScene = useCallback(
    async (sceneId: string, payload: SceneUpdatePayload): Promise<SceneSummary | null> => {
      if (!baseUrl) return null;
      // Optimistic update
      setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, ...payload } : s)));
      try {
        const res = await fetch(`${baseUrl}/${sceneId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to update scene'));
        const { data } = (await res.json()) as { data: SceneSummary };
        setScenes((prev) => prev.map((s) => (s.id === sceneId ? data : s)));
        setError(null);
        return data;
      } catch (err: unknown) {
        // Re-sync first so the mutation error isn't wiped by the refresh
        await refresh();
        setError(err instanceof Error ? err.message : 'Failed to update scene');
        return null;
      }
    },
    [baseUrl, refresh],
  );

  const deleteScene = useCallback(
    async (sceneId: string): Promise<boolean> => {
      if (!baseUrl) return false;
      try {
        const res = await fetch(`${baseUrl}/${sceneId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to delete scene'));
        setScenes((prev) => prev.filter((s) => s.id !== sceneId));
        setError(null);
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete scene');
        return false;
      }
    },
    [baseUrl],
  );

  const duplicateScene = useCallback(
    async (sceneId: string): Promise<SceneSummary | null> => {
      if (!baseUrl) return null;
      try {
        const res = await fetch(`${baseUrl}/${sceneId}/duplicate`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to duplicate scene'));
        const { data } = (await res.json()) as { data: SceneSummary };
        setScenes((prev) => [...prev, data]);
        setError(null);
        return data;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to duplicate scene');
        return null;
      }
    },
    [baseUrl],
  );

  const reorderScenes = useCallback(
    async (sceneIds: string[]): Promise<void> => {
      if (!baseUrl) return;
      // Optimistic reorder
      setScenes((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]));
        const ordered = sceneIds
          .map((id) => byId.get(id))
          .filter((s): s is SceneSummary => s !== undefined);
        return ordered.length === prev.length ? ordered : prev;
      });
      try {
        const res = await fetch(`${baseUrl}/order`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sceneIds }),
        });
        if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to reorder scenes'));
        const { data } = (await res.json()) as { data: SceneSummary[] };
        setScenes(data);
        setError(null);
      } catch (err: unknown) {
        // Re-sync first so the mutation error isn't wiped by the refresh
        await refresh();
        setError(err instanceof Error ? err.message : 'Failed to reorder scenes');
      }
    },
    [baseUrl, refresh],
  );

  const uploadThumbnail = useCallback(
    async (sceneId: string, blob: Blob): Promise<void> => {
      if (!baseUrl) return;
      const form = new FormData();
      const ext = blob.type === 'image/webp' ? 'webp' : 'png';
      form.append('file', blob, `thumbnail.${ext}`);
      const res = await fetch(`${baseUrl}/${sceneId}/thumbnail`, {
        method: 'PUT',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to upload thumbnail'));
      const { data } = (await res.json()) as { data: SceneSummary };
      setScenes((prev) => prev.map((s) => (s.id === sceneId ? data : s)));
    },
    [baseUrl],
  );

  return {
    scenes,
    isLoading,
    error,
    createScene,
    updateScene,
    deleteScene,
    duplicateScene,
    reorderScenes,
    uploadThumbnail,
    refresh,
  };
}
