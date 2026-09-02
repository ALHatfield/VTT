import { useEffect, useState } from 'react';

import type { CampaignPlayer, CampaignRole } from '@vtt/shared';
import { DEFAULT_TOKEN_COLOR } from '@vtt/shared';

interface UseCampaignRoleReturn {
  role: CampaignRole | null;
  /** The current user's campaign-scoped color (null until loaded). */
  playerColor: string;
  isLoading: boolean;
}

export function useCampaignRole(
  campaignId: string | undefined,
  userId?: string,
): UseCampaignRoleReturn {
  const [role, setRole] = useState<CampaignRole | null>(null);
  const [playerColor, setPlayerColor] = useState<string>(DEFAULT_TOKEN_COLOR);
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
        const body = (await res.json()) as {
          data?: { role?: CampaignRole; members?: CampaignPlayer[] };
        };
        if (cancelled) return;
        setRole(body.data?.role ?? null);
        if (userId && body.data?.members) {
          const member = body.data.members.find((m) => m.userId === userId);
          if (member?.color) setPlayerColor(member.color);
        }
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
  }, [campaignId, userId]);

  return { role, playerColor, isLoading };
}
