import { useCallback, useEffect, useState } from 'react';

import type { CharacterToken } from '@vtt/shared';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error?.message ?? 'Request failed');
  }

  return body;
}

interface UseCharacterLinkingResult {
  /** Character-token links in the campaign */
  links: CharacterToken[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  unlink: (linkId: string) => Promise<void>;
  assign: (characterId: string, userId: string) => Promise<void>;
}

/**
 * Character-token link state and actions for the campaign settings page.
 * Assignment auto-links the member's player token server-side.
 */
export function useCharacterLinking(campaignId: string): UseCharacterLinkingResult {
  const [links, setLinks] = useState<CharacterToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const linksBody = await apiFetch<{ data: CharacterToken[] }>(
          `/api/campaigns/${campaignId}/character-tokens`,
        );

        if (!cancelled) {
          setLinks(linksBody.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load link data');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [campaignId, tick]);

  const unlink = useCallback(
    async (linkId: string): Promise<void> => {
      await apiFetch(`/api/campaigns/${campaignId}/character-tokens/${linkId}`, {
        method: 'DELETE',
      });
      refresh();
    },
    [campaignId, refresh],
  );

  const assign = useCallback(
    async (characterId: string, userId: string): Promise<void> => {
      await apiFetch(`/api/campaigns/${campaignId}/characters/${characterId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      refresh();
    },
    [campaignId, refresh],
  );

  return { links, isLoading, error, refresh, unlink, assign };
}
