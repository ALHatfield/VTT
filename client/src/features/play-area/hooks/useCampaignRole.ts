import { useEffect, useState } from 'react';

import type { CampaignRole } from '@vtt/shared';

interface UseCampaignRoleReturn {
  role: CampaignRole | null;
  isLoading: boolean;
}

export function useCampaignRole(campaignId: string | undefined): UseCampaignRoleReturn {
  const [role, setRole] = useState<CampaignRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    fetch(`/api/campaigns/${campaignId}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (cancelled) return;
        const body = (await res.json()) as { data?: { role?: CampaignRole } };
        if (!cancelled) setRole(body.data?.role ?? null);
      })
      .catch((err: unknown) => {
        console.error('[useCampaignRole] Failed to fetch campaign role:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return (): void => {
      cancelled = true;
    };
  }, [campaignId]);

  return { role, isLoading };
}
