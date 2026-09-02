/**
 * Campaign Types
 * Shared between client and server
 */

/**
 * Campaign role enum
 */
export type CampaignRole = 'dm' | 'player' | 'observer';

/**
 * A campaign — the top-level workspace for a TTRPG session
 */
export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** The authenticated user's role in this campaign */
  role: CampaignRole;
}

/**
 * A member entry linking a user to a campaign with a role
 */
export interface CampaignPlayer {
  id: string;
  campaignId: string;
  userId: string;
  role: CampaignRole;
  username: string;
  color: string | null;
  joinedAt: Date;
}

/**
 * Payload for creating a new campaign
 */
export interface CampaignCreatePayload {
  name: string;
  description?: string;
}

/**
 * Payload for updating an existing campaign
 */
export interface CampaignUpdatePayload {
  name?: string;
  description?: string | null;
}

/**
 * Response shape for campaign list endpoint
 */
export interface CampaignListResponse {
  data: Campaign[];
}

/**
 * Response shape for campaign detail endpoint
 */
export interface CampaignDetailResponse {
  data: Campaign & { members: CampaignPlayer[] };
}

/**
 * Payload for inviting a user to a campaign by email
 */
export interface CampaignInvitePayload {
  email: string;
  role: 'player' | 'observer';
}
