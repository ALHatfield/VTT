import type { CampaignPlayer } from '@vtt/shared';
import { useCallback } from 'react';

export function useMemberActions(): {
  inviteMember: (campaignId: string, email: string, role: 'player' | 'observer') => Promise<CampaignPlayer>;
  removeMember: (campaignId: string, userId: string) => Promise<void>;
  leaveCampaign: (campaignId: string) => Promise<void>;
} {
  const inviteMember = useCallback(
    async (campaignId: string, email: string, role: 'player' | 'observer'): Promise<CampaignPlayer> => {
      const response = await fetch(`/api/campaigns/${campaignId}/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Invite failed');
      return body.data as CampaignPlayer;
    },
    [],
  );

  const removeMember = useCallback(
    async (campaignId: string, userId: string): Promise<void> => {
      const response = await fetch(`/api/campaigns/${campaignId}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: { message?: string } })?.error?.message ?? 'Remove failed');
      }
    },
    [],
  );

  const leaveCampaign = useCallback(
    async (campaignId: string): Promise<void> => {
      const response = await fetch(`/api/campaigns/${campaignId}/leave`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: { message?: string } })?.error?.message ?? 'Leave failed');
      }
    },
    [],
  );

  return { inviteMember, removeMember, leaveCampaign };
}
