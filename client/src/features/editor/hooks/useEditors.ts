import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for fetching editor data — Phase 5A
 */
export function useEditors(): { data: unknown[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEditors = useCallback(async () => {
    try {
      setLoading(true);
      // TODO: implement fetch
      setData([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEditors();
  }, [fetchEditors]);

  return { data, loading, error };
}
