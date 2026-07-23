import { useCallback, useEffect, useRef, useState } from 'react';

import type { Token, TokenCreatePayload } from '@vtt/shared';

interface UseTokensReturn {
  tokens: Token[];
  isLoading: boolean;
  error: string | null;
  createToken: (payload: TokenCreatePayload) => Promise<Token>;
  moveToken: (tokenId: string, x: number, y: number) => Promise<void>;
  updateTokenHp: (tokenId: string, hp: number) => Promise<void>;
  applyRemoteTokenMove: (tokenId: string, x: number, y: number) => void;
  applyRemoteTokenUpdate: (token: Token) => void;
  addRemoteToken: (token: Token) => void;
  removeRemoteToken: (tokenId: string) => void;
  refresh: () => void;
}

export function useTokens(
  campaignId: string | undefined,
  sceneId: string | undefined,
): UseTokensReturn {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tick counter to trigger refetches
  const [tick, setTick] = useState(0);

  // Track in-flight optimistic updates by tokenId → previous state
  const previousPositions = useRef(new Map<string, { x: number; y: number }>());

  const fetchTokens = useCallback(async (): Promise<void> => {
    if (!campaignId || !sceneId) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ?? 'Failed to load tokens',
        );
      }

      const data = (await res.json()) as { data: Token[] };
      setTokens(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tokens');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, sceneId]);

  useEffect(() => {
    fetchTokens().catch((err: unknown) => {
      console.error('[useTokens] Unexpected error:', err);
    });
  }, [fetchTokens, tick]);

  const moveToken = useCallback(
    async (tokenId: string, x: number, y: number): Promise<void> => {
      if (!campaignId || !sceneId) return;

      // Optimistic update
      setTokens((prev) => {
        const target = prev.find((t) => t.id === tokenId);
        if (target) {
          previousPositions.current.set(tokenId, { x: target.x, y: target.y });
        }
        return prev.map((t) => (t.id === tokenId ? { ...t, x, y } : t));
      });

      try {
        const res = await fetch(
          `/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${tokenId}/position`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y }),
          },
        );

        if (!res.ok) {
          // Roll back optimistic update
          const prev = previousPositions.current.get(tokenId);
          if (prev) {
            setTokens((current) =>
              current.map((t) => (t.id === tokenId ? { ...t, x: prev.x, y: prev.y } : t)),
            );
          }
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: { message?: string } }).error?.message ?? 'Failed to move token',
          );
        }

        // Sync confirmed position from server
        const data = (await res.json()) as { data: Token };
        setTokens((current) => current.map((t) => (t.id === tokenId ? data.data : t)));
        previousPositions.current.delete(tokenId);
      } catch (err) {
        console.error('[useTokens] moveToken failed:', err);
        throw err;
      }
    },
    [campaignId, sceneId],
  );

  const refresh = useCallback((): void => {
    setTick((n) => n + 1);
  }, []);

  const updateTokenHp = useCallback(
    async (tokenId: string, hp: number): Promise<void> => {
      if (!campaignId || !sceneId) return;

      // Optimistic update
      setTokens((prev) => prev.map((t) => (t.id === tokenId ? { ...t, hp } : t)));

      try {
        const res = await fetch(
          `/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${tokenId}`,
          {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hp }),
          },
        );

        if (!res.ok) {
          // Revert on failure by refreshing from server
          setTick((n) => n + 1);
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: { message?: string } }).error?.message ?? 'Failed to update HP',
          );
        }

        const data = (await res.json()) as { data: Token };
        setTokens((current) => current.map((t) => (t.id === tokenId ? data.data : t)));
      } catch (err) {
        console.error('[useTokens] updateTokenHp failed:', err);
        throw err;
      }
    },
    [campaignId, sceneId],
  );

  const applyRemoteTokenMove = useCallback((tokenId: string, x: number, y: number): void => {
    setTokens((prev) => prev.map((t) => (t.id === tokenId ? { ...t, x, y } : t)));
  }, []);

  /** Replace a token's full state from a remote TOKEN_UPDATED broadcast. */
  const applyRemoteTokenUpdate = useCallback((token: Token): void => {
    setTokens((prev) => prev.map((t) => (t.id === token.id ? token : t)));
  }, []);

  /** Add a token received via TOKEN_CREATED broadcast (deduplicates by id). */
  const addRemoteToken = useCallback((token: Token): void => {
    setTokens((prev) => {
      if (prev.some((t) => t.id === token.id)) return prev;
      return [...prev, token];
    });
  }, []);

  /** Remove a token received via TOKEN_DELETED broadcast. */
  const removeRemoteToken = useCallback((tokenId: string): void => {
    setTokens((prev) => prev.filter((t) => t.id !== tokenId));
  }, []);

  const createToken = useCallback(
    async (payload: TokenCreatePayload): Promise<Token> => {
      if (!campaignId || !sceneId) {
        throw new Error('Cannot create token before campaign and scene are loaded');
      }

      const res = await fetch(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ?? 'Failed to create token',
        );
      }

      const data = (await res.json()) as { data: Token };
      // Add locally in case the socket TOKEN_CREATED broadcast races or is missed;
      // addRemoteToken dedupes by id so the socket event is a safe no-op.
      setTokens((prev) => {
        if (prev.some((t) => t.id === data.data.id)) return prev;
        return [...prev, data.data];
      });
      return data.data;
    },
    [campaignId, sceneId],
  );

  return {
    tokens,
    isLoading,
    error,
    createToken,
    moveToken,
    updateTokenHp,
    applyRemoteTokenMove,
    applyRemoteTokenUpdate,
    addRemoteToken,
    removeRemoteToken,
    refresh,
  };
}
