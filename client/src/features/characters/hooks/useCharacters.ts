import type { Character } from '@vtt/shared';
import { useCallback, useEffect, useState } from 'react';

interface UseCharactersResult {
  characters: Character[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCharacters(campaignId: string): UseCharactersResult {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchCharacters(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/characters`, {
          credentials: 'include',
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.error?.message ?? 'Failed to load characters');
        }

        if (!cancelled) {
          setCharacters(body.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load characters');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchCharacters();

    return () => {
      cancelled = true;
    };
  }, [campaignId, tick]);

  return { characters, isLoading, error, refresh };
}
