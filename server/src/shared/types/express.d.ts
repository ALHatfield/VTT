import type { CampaignRole } from '@vtt/shared';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireCampaignRole middleware — the authenticated user's role in the current campaign */
      campaignRole?: CampaignRole;
      /** Set by requireCampaignRole middleware — the campaign ID from the route param */
      campaignId?: string;
    }
  }
}
