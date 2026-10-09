// useLightSources — Phase 5G
// DM-only REST CRUD for authored lights on a scene. Updates apply optimistically and
// are debounced per light so slider drags don't flood the server.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LightSource, LightSourceCreatePayload, LightSourceUpdatePayload } from '@vtt/shared';

import { editorSaveTracker } from '../utils/save-tracker';

export const LIGHT_UPDATE_DEBOUNCE_MS = 300;

interface PendingUpdate {
  payload: LightSourceUpdatePayload;
  timer: ReturnType<typeof setTimeout>;
}

interface UseLightSourcesReturn {
  lights: LightSource[];
  error: string | null;
  createLight: (payload: LightSourceCreatePayload) => Promise<LightSource | null>;
  updateLight: (lightId: string, payload: LightSourceUpdatePayload) => void;
  deleteLight: (lightId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return body.error?.message ?? `${fallback}: HTTP ${res.status}`;
}

export function useLightSources(
  campaignId: string | undefined,
  sceneId: string | undefined,
  enabled: boolean,
): UseLightSourcesReturn {
  const [lights, setLights] = useState<LightSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Discards responses from superseded fetches, including any in flight when a local edit starts
  const fetchSeqRef = useRef(0);
  const pendingRef = useRef(new Map<string, PendingUpdate>());
  // Sent but unacknowledged edits, kept on top of refreshes until the PATCH settles
  const inFlightRef = useRef(new Map<string, LightSourceUpdatePayload>());
  // Latest PATCH per light, so an older response can't overwrite a newer one
  const updateSeqRef = useRef(new Map<string, number>());

  const baseUrl =
    enabled && campaignId && sceneId
      ? `/api/campaigns/${campaignId}/scenes/${sceneId}/lights`
      : null;
  const baseUrlRef = useRef(baseUrl);
  useEffect(() => {
    baseUrlRef.current = baseUrl;
  }, [baseUrl]);

  const beginMutation = useCallback((): void => {
    fetchSeqRef.current++;
    setError(null);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const seq = ++fetchSeqRef.current;
    if (!baseUrl) {
      setLights([]);
      return;
    }
    try {
      const res = await fetch(baseUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to load lights'));
      const body = (await res.json()) as { data: LightSource[] };
      if (seq !== fetchSeqRef.current) return;
      // Keep unsent and unacknowledged local edits on top of the server snapshot
      setLights(
        body.data.map((light) => ({
          ...light,
          ...inFlightRef.current.get(light.id),
          ...pendingRef.current.get(light.id)?.payload,
        })),
      );
    } catch (err: unknown) {
      if (seq === fetchSeqRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load lights');
      }
    }
  }, [baseUrl]);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    setLights([]);
    void refresh();
  }, [refresh]);

  const sendUpdate = useCallback(
    async (url: string, lightId: string, payload: LightSourceUpdatePayload): Promise<void> => {
      const seq = (updateSeqRef.current.get(lightId) ?? 0) + 1;
      updateSeqRef.current.set(lightId, seq);
      inFlightRef.current.set(lightId, payload);
      const isLatest = (): boolean => updateSeqRef.current.get(lightId) === seq;
      try {
        const body = await editorSaveTracker.track(
          async (): Promise<{ data: LightSource } | null> => {
            const res = await fetch(`${url}/${lightId}`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            // Deleted mid-edit — nothing to reconcile
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to update light'));
            return (await res.json()) as { data: LightSource };
          },
          `light:${lightId}`,
        );
        if (!body) return;
        const { data } = body;
        const isStale =
          baseUrlRef.current !== url || !isLatest() || pendingRef.current.has(lightId);
        if (isStale) return;
        setLights((prev) => prev.map((l) => (l.id === lightId ? data : l)));
      } catch (err: unknown) {
        if (baseUrlRef.current !== url) return;
        setError(err instanceof Error ? err.message : 'Failed to update light');
        void refreshRef.current();
      } finally {
        if (isLatest()) inFlightRef.current.delete(lightId);
      }
    },
    [],
  );

  // Flush unsent edits to the scene they were made on when the scene changes or on unmount
  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      if (!baseUrl) return;
      for (const [lightId, { payload, timer }] of pending) {
        clearTimeout(timer);
        editorSaveTracker.setPending(`light:${lightId}`, false);
        void sendUpdate(baseUrl, lightId, payload);
      }
      pending.clear();
    };
  }, [baseUrl, sendUpdate]);

  const createLight = useCallback(
    async (payload: LightSourceCreatePayload): Promise<LightSource | null> => {
      if (!baseUrl) return null;
      beginMutation();
      try {
        const { data } = await editorSaveTracker.track(async () => {
          const res = await fetch(baseUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to create light'));
          return (await res.json()) as { data: LightSource };
        });
        if (baseUrlRef.current !== baseUrl) return data;
        // A socket-triggered refresh may already have added this light
        setLights((prev) => (prev.some((l) => l.id === data.id) ? prev : [...prev, data]));
        return data;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to create light');
        return null;
      }
    },
    [baseUrl, beginMutation],
  );

  const updateLight = useCallback(
    (lightId: string, payload: LightSourceUpdatePayload): void => {
      if (!baseUrl) return;
      beginMutation();
      setLights((prev) => prev.map((l) => (l.id === lightId ? { ...l, ...payload } : l)));

      const existing = pendingRef.current.get(lightId);
      if (existing) clearTimeout(existing.timer);
      const merged = { ...existing?.payload, ...payload };
      editorSaveTracker.setPending(`light:${lightId}`, true);
      const timer = setTimeout(() => {
        pendingRef.current.delete(lightId);
        editorSaveTracker.setPending(`light:${lightId}`, false);
        void sendUpdate(baseUrl, lightId, merged);
      }, LIGHT_UPDATE_DEBOUNCE_MS);
      pendingRef.current.set(lightId, { payload: merged, timer });
    },
    [baseUrl, beginMutation, sendUpdate],
  );

  const deleteLight = useCallback(
    async (lightId: string): Promise<void> => {
      if (!baseUrl) return;
      beginMutation();
      const pending = pendingRef.current.get(lightId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRef.current.delete(lightId);
        editorSaveTracker.setPending(`light:${lightId}`, false);
      }
      setLights((prev) => prev.filter((l) => l.id !== lightId));
      try {
        await editorSaveTracker.track(async () => {
          const res = await fetch(`${baseUrl}/${lightId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (!res.ok && res.status !== 404) {
            throw new Error(await readErrorMessage(res, 'Failed to delete light'));
          }
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete light');
        void refresh();
      }
    },
    [baseUrl, beginMutation, refresh],
  );

  return { lights, error, createLight, updateLight, deleteLight, refresh };
}
