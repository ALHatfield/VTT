import type { Campaign, CampaignUpdatePayload } from '@vtt/shared';
import { useCallback } from 'react';

/**
 * Provides update and delete mutations for a single campaign.
 * Does NOT fetch the campaign list — use useCampaignDetail for that.
 */
export function useCampaignActions(): {
  updateCampaign: (id: string, payload: CampaignUpdatePayload) => Promise<Campaign>;
  deleteCampaign: (id: string) => Promise<void>;
} {
  const updateCampaign = useCallback(
    async (id: string, payload: CampaignUpdatePayload): Promise<Campaign> => {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Update failed');
      return body.data as Campaign;
    },
    [],
  );

  const deleteCampaign = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/campaigns/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok && response.status !== 204) {
      const body = await response.json().catch(() => ({}));
      throw new Error((body as { error?: { message?: string } })?.error?.message ?? 'Delete failed');
    }
  }, []);

  return { updateCampaign, deleteCampaign };
}
