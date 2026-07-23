import type { Campaign, CampaignPlayer } from '@vtt/shared';
import { useCallback, useEffect, useState } from 'react';

interface CampaignDetail extends Campaign {
  members: CampaignPlayer[];
}

interface UseCampaignDetailResult {
  campaign: CampaignDetail | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCampaignDetail(campaignId: string): UseCampaignDetailResult {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchCampaign(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`, {
          credentials: 'include',
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.error?.message ?? 'Failed to load campaign');
        }

        if (!cancelled) {
          setCampaign(body.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load campaign');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchCampaign();

    return () => {
      cancelled = true;
    };
  }, [campaignId, tick]);

  return { campaign, isLoading, error, refresh };
}
