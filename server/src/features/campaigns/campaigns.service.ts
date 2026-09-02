import type { Campaign, CampaignPlayer, CampaignRole } from '@vtt/shared';
import { PLAYER_COLOR_PALETTE } from '@vtt/shared';
import { prisma } from '../../shared/db/prisma.js';

/**
 * Map a raw Prisma campaign+membership to the shared Campaign type
 */
function toCampaign(
  raw: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  role: CampaignRole,
): Campaign {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    role,
  };
}

/**
 * Map a raw Prisma campaign_player + user to the shared CampaignPlayer type
 */
function toCampaignPlayer(raw: {
  id: string;
  campaignId: string;
  userId: string;
  role: string;
  color: string | null;
  joinedAt: Date;
  user: { username: string };
}): CampaignPlayer {
  return {
    id: raw.id,
    campaignId: raw.campaignId,
    userId: raw.userId,
    role: raw.role as CampaignRole,
    username: raw.user.username,
    color: raw.color,
    joinedAt: raw.joinedAt,
  };
}

/**
 * List all campaigns a user belongs to
 */
export async function listCampaignsForUser(userId: string): Promise<Campaign[]> {
  const memberships = await prisma.campaignPlayer.findMany({
    where: { userId },
    include: { campaign: true },
    orderBy: { campaign: { updatedAt: 'desc' } },
  });

  return memberships.map((m) => toCampaign(m.campaign, m.role as CampaignRole));
}

/**
 * Get a single campaign with its member list (caller must already be a member)
 */
export async function getCampaignWithMembers(
  campaignId: string,
): Promise<(Campaign & { members: CampaignPlayer[] }) | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!campaign) return null;

  // Derive the campaign's DM membership to satisfy the type shape — caller provides the role
  // separately. Return an untyped role sentinel; caller attaches the real role.
  const members = campaign.members.map(toCampaignPlayer);

  // We return a partial — callers pass their own role via the requireCampaignRole middleware.
  // For the detail response we embed members and use the DM role as the campaign role sentinel.
  const dmMembership = campaign.members.find((m) => m.role === 'dm');
  const roleForSentinel = (dmMembership?.role ?? 'dm') as CampaignRole;

  return {
    ...toCampaign(campaign, roleForSentinel),
    members,
  };
}

/**
 * Create a new campaign and assign the creator as DM
 */
export async function createCampaign(
  userId: string,
  name: string,
  description?: string,
): Promise<Campaign> {
  const campaign = await prisma.campaign.create({
    data: {
      name,
      description: description ?? null,
      members: {
        create: {
          userId,
          role: 'dm',
          color: PLAYER_COLOR_PALETTE[0],
        },
      },
    },
  });

  return toCampaign(campaign, 'dm');
}

/**
 * Update a campaign's name and/or description (DM only — enforced at route level)
 */
export async function updateCampaign(
  campaignId: string,
  updates: { name?: string; description?: string | null },
): Promise<Campaign> {
  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: updates,
  });

  // Role is fetched at route level — return with dm sentinel; caller can ignore role
  return toCampaign(updated, 'dm');
}

/**
 * Delete a campaign and all related data (DM only — enforced at route level).
 * Cascade delete is handled by the Prisma schema.
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  await prisma.campaign.delete({ where: { id: campaignId } });
}

/**
 * Result of inviting a member.
 * Includes userId and username so the route can handle token provisioning
 * in the play-area feature (avoiding a cross-feature service dependency).
 */
export interface InviteResult {
  member: CampaignPlayer;
  /** The invited user's ID — used by the route to auto-create a player token */
  invitedUserId: string;
  /** The invited user's username — used by the route to name the auto-created token */
  invitedUsername: string;
}

/** Compute the next palette color for a new member based on current member count. */
async function nextPaletteColor(campaignId: string): Promise<string> {
  const memberCount = await prisma.campaignPlayer.count({ where: { campaignId } });
  return PLAYER_COLOR_PALETTE[memberCount % PLAYER_COLOR_PALETTE.length];
}

/**
 * Invite a user by email to join a campaign with the specified role.
 * Returns the new CampaignPlayer record plus the invited user's ID and username
 * so the caller can handle token provisioning without cross-feature service imports.
 */
export async function inviteMember(
  campaignId: string,
  email: string,
  role: 'player' | 'observer',
): Promise<InviteResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error('No user found with that email address');
    (err as NodeJS.ErrnoException).code = 'USER_NOT_FOUND';
    throw err;
  }

  const existing = await prisma.campaignPlayer.findUnique({
    where: { campaignId_userId: { campaignId, userId: user.id } },
  });
  if (existing) {
    const err = new Error('User is already a member of this campaign');
    (err as NodeJS.ErrnoException).code = 'ALREADY_MEMBER';
    throw err;
  }

  const color = await nextPaletteColor(campaignId);

  const membership = await prisma.campaignPlayer.create({
    data: { campaignId, userId: user.id, role, color },
    include: { user: true },
  });

  return {
    member: toCampaignPlayer(membership),
    invitedUserId: user.id,
    invitedUsername: user.username,
  };
}

/**
 * Remove a member from a campaign (DM only — enforced at route level).
 * The DM cannot be removed via this function.
 */
export async function removeMember(campaignId: string, targetUserId: string): Promise<void> {
  const membership = await prisma.campaignPlayer.findUnique({
    where: { campaignId_userId: { campaignId, userId: targetUserId } },
  });

  if (!membership) {
    const err = new Error('Member not found in this campaign');
    (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
    throw err;
  }

  if (membership.role === 'dm') {
    const err = new Error('The DM cannot be removed from the campaign');
    (err as NodeJS.ErrnoException).code = 'CANNOT_REMOVE_DM';
    throw err;
  }

  await prisma.campaignPlayer.delete({
    where: { campaignId_userId: { campaignId, userId: targetUserId } },
  });
}

/**
 * Leave a campaign voluntarily.
 * The DM cannot leave — they must delete the campaign instead.
 */
export async function leaveCampaign(campaignId: string, userId: string): Promise<void> {
  const membership = await prisma.campaignPlayer.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
  });

  if (!membership) {
    const err = new Error('You are not a member of this campaign');
    (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
    throw err;
  }

  if (membership.role === 'dm') {
    const err = new Error('The DM cannot leave a campaign — delete the campaign instead');
    (err as NodeJS.ErrnoException).code = 'DM_CANNOT_LEAVE';
    throw err;
  }

  await prisma.campaignPlayer.delete({
    where: { campaignId_userId: { campaignId, userId } },
  });
}
