import type { Campaign, CampaignCreatePayload, CampaignUpdatePayload } from '@vtt/shared';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';

interface UseCampaignsResult {
  campaigns: Campaign[];
  isLoading: boolean;
  error: string | null;
  createCampaign: (payload: CampaignCreatePayload) => Promise<Campaign>;
  updateCampaign: (id: string, payload: CampaignUpdatePayload) => Promise<Campaign>;
  deleteCampaign: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  // 204 No Content — body is empty, nothing to parse
  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error?.message ?? 'Request failed');
  }

  return body;
}

export function useCampaigns(): UseCampaignsResult {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchCampaigns = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const body = await apiFetch<{ data: Campaign[] }>('/api/campaigns');
      setCampaigns(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const body = await apiFetch<{ data: Campaign[] }>('/api/campaigns');
        if (!cancelled) setCampaigns(body.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const createCampaign = useCallback(
    async (payload: CampaignCreatePayload): Promise<Campaign> => {
      const body = await apiFetch<{ data: Campaign }>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await fetchCampaigns();
      return body.data;
    },
    [fetchCampaigns],
  );

  const updateCampaign = useCallback(
    async (id: string, payload: CampaignUpdatePayload): Promise<Campaign> => {
      const body = await apiFetch<{ data: Campaign }>(`/api/campaigns/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await fetchCampaigns();
      return body.data;
    },
    [fetchCampaigns],
  );

  const deleteCampaign = useCallback(
    async (id: string): Promise<void> => {
      await apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      await fetchCampaigns();
    },
    [fetchCampaigns],
  );

  return {
    campaigns,
    isLoading,
    error,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    refresh: fetchCampaigns,
  };
}
