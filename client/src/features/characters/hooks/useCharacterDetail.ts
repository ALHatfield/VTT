import type { Character } from '@vtt/shared';
import { useCallback, useEffect, useState } from 'react';

interface UseCharacterDetailResult {
  character: Character | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCharacterDetail(
  campaignId: string,
  characterId: string,
): UseCharacterDetailResult {
  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchCharacter(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/campaigns/${campaignId}/characters/${characterId}`,
          { credentials: 'include' },
        );
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.error?.message ?? 'Failed to load character');
        }

        if (!cancelled) {
          setCharacter(body.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load character');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchCharacter();

    return () => {
      cancelled = true;
    };
  }, [campaignId, characterId, tick]);

  return { character, isLoading, error, refresh };
}
