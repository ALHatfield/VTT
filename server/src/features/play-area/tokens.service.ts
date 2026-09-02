import type {
  AuraCondition,
  AuraType,
  CampaignRole,
  NpcSubtype,
  Scene,
  Token,
  TokenType,
} from '@vtt/shared';
import { DEFAULT_TOKEN_COLOR, DEFAULT_TOKEN_SIZE, DEFAULT_VISION_RADIUS } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';
import { AppError } from '../../shared/middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toScene(raw: {
  id: string;
  campaignId: string;
  name: string;
  imageUrl: string | null;
  width: number;
  height: number;
  cellSize: number;
  isActive: boolean;
}): Scene {
  return {
    id: raw.id,
    campaignId: raw.campaignId,
    name: raw.name,
    imageUrl: raw.imageUrl,
    width: raw.width,
    height: raw.height,
    cellSize: raw.cellSize,
    isActive: raw.isActive,
  };
}

function toToken(raw: {
  id: string;
  sceneId: string;
  campaignId: string;
  ownerId: string | null;
  name: string;
  type: string;
  x: number;
  y: number;
  size: number;
  color: string;
  iconUrl: string | null;
  hp: number | null;
  maxHp: number | null;
  ac: number | null;
  visionRadius: number;
  auraRadius: number | null;
  auraColor: string | null;
  auraVisible: boolean;
  auraType: string | null;
  auraCondition: string | null;
  npcSubtype: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner?: { username: string } | null;
}): Token {
  return {
    id: raw.id,
    sceneId: raw.sceneId,
    campaignId: raw.campaignId,
    ownerId: raw.ownerId,
    ownerName: raw.owner?.username ?? null,
    name: raw.name,
    type: raw.type as TokenType,
    x: raw.x,
    y: raw.y,
    size: raw.size,
    color: raw.color,
    iconUrl: raw.iconUrl,
    hp: raw.hp,
    maxHp: raw.maxHp,
    ac: raw.ac,
    visionRadius: raw.visionRadius,
    auraRadius: raw.auraRadius,
    auraColor: raw.auraColor,
    auraVisible: raw.auraVisible,
    auraType: (raw.auraType as AuraType | null) ?? null,
    auraCondition: (raw.auraCondition as AuraCondition | null) ?? null,
    npcSubtype: (raw.npcSubtype as NpcSubtype | null) ?? null,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

// Player token color palette — used when auto-creating tokens on invite
const PLAYER_TOKEN_COLORS = [
  '#4a9eff',
  '#ff6b6b',
  '#51cf66',
  '#ffd43b',
  '#cc5de8',
  '#ff922b',
  '#20c997',
  '#f06595',
  '#74c0fc',
  '#a9e34b',
];

function randomPlayerColor(): string {
  return PLAYER_TOKEN_COLORS[Math.floor(Math.random() * PLAYER_TOKEN_COLORS.length)]!;
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

/**
 * Return the active scene for a campaign, or auto-create a default one if none exists.
 */
export async function getOrCreateActiveScene(campaignId: string): Promise<Scene> {
  // Wrap in a transaction to prevent concurrent requests from creating duplicate active scenes
  return prisma.$transaction(async (tx) => {
    const existing = await tx.scene.findFirst({
      where: { campaignId, isActive: true },
    });

    if (existing) return toScene(existing);

    const scene = await tx.scene.create({
      data: {
        campaignId,
        name: 'Default Scene',
        isActive: true,
        width: 2048,
        height: 2048,
        cellSize: 70,
      },
    });

    return toScene(scene);
  });
}

/**
 * Get a specific scene, validating it belongs to the campaign.
 * Returns null if not found.
 */
export async function getSceneById(sceneId: string, campaignId: string): Promise<Scene | null> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, campaignId },
  });

  return scene ? toScene(scene) : null;
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * List all tokens for a given scene (already scoped to campaign via scene ownership).
 */
export async function listTokens(sceneId: string, campaignId: string): Promise<Token[]> {
  // Validate scene belongs to campaign
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, campaignId } });
  if (!scene) {
    throw new AppError(404, 'NOT_FOUND', 'Scene not found');
  }

  const tokens = await prisma.token.findMany({
    where: { sceneId },
    include: { owner: { select: { username: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return tokens.map(toToken);
}

/**
 * Create a token on a scene (DM only — enforced at route level).
 */
export async function createToken(
  sceneId: string,
  campaignId: string,
  data: {
    name: string;
    type: string;
    x: number;
    y: number;
    size?: number;
    color?: string;
    iconUrl?: string;
    hp?: number;
    maxHp?: number;
    ac?: number;
    ownerId?: string;
    visionRadius?: number;
    auraRadius?: number;
    auraColor?: string;
    auraVisible?: boolean;
    auraType?: string;
    auraCondition?: string | null;
    npcSubtype?: string;
  },
): Promise<Token> {
  // Validate scene belongs to campaign
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, campaignId } });
  if (!scene) {
    throw new AppError(404, 'NOT_FOUND', 'Scene not found');
  }

  // If ownerId is provided, validate user is a campaign member
  if (data.ownerId) {
    const membership = await prisma.campaignPlayer.findUnique({
      where: { campaignId_userId: { campaignId, userId: data.ownerId } },
    });
    if (!membership) {
      throw new AppError(400, 'INVALID_OWNER', 'Token owner must be a campaign member');
    }
  }

  const token = await prisma.token.create({
    data: {
      sceneId,
      campaignId,
      name: data.name,
      type: data.type as TokenType,
      x: data.x,
      y: data.y,
      size: data.size ?? DEFAULT_TOKEN_SIZE,
      color: data.color ?? DEFAULT_TOKEN_COLOR,
      iconUrl: data.iconUrl ?? null,
      hp: data.hp ?? null,
      maxHp: data.maxHp ?? null,
      ac: data.ac ?? null,
      visionRadius: data.visionRadius ?? DEFAULT_VISION_RADIUS,
      auraRadius: data.auraRadius ?? null,
      auraColor: data.auraColor ?? null,
      auraVisible: data.auraVisible ?? false,
      auraType: data.auraType ?? null,
      auraCondition: data.auraCondition ?? null,
      ownerId: data.ownerId ?? null,
      npcSubtype: (data.npcSubtype as NpcSubtype | undefined) ?? null,
    },
    include: { owner: { select: { username: true } } },
  });

  return toToken(token);
}

/**
 * Update token fields (name, type, size, color, hp, ac, etc.).
 * DM can update any token; Player can only update their own.
 */
export async function updateToken(
  tokenId: string,
  sceneId: string,
  campaignId: string,
  data: {
    name?: string;
    type?: string;
    size?: number;
    color?: string;
    iconUrl?: string | null;
    hp?: number | null;
    maxHp?: number | null;
    ac?: number | null;
    visionRadius?: number;
    auraRadius?: number | null;
    auraColor?: string | null;
    auraVisible?: boolean;
    auraType?: string | null;
    auraCondition?: string | null;
    npcSubtype?: string | null;
  },
  userId: string,
  userRole: CampaignRole,
): Promise<Token> {
  const token = await prisma.token.findFirst({ where: { id: tokenId, sceneId, campaignId } });
  if (!token) {
    throw new AppError(404, 'NOT_FOUND', 'Token not found');
  }

  assertCanWriteToken(token, userId, userRole, 'modify');

  // Only the DM may change visionRadius — a player setting a large radius would
  // punch an unauthorised hole through the fog of war for all clients.
  if (userRole !== 'dm' && data.visionRadius !== undefined) {
    throw new AppError(403, 'FORBIDDEN', "Only the DM can change a token's vision radius");
  }

  // Only the DM may change npcSubtype — players should not be able to make
  // their own token appear as an ally NPC (which grants shared party vision).
  if (userRole !== 'dm' && data.npcSubtype !== undefined) {
    throw new AppError(403, 'FORBIDDEN', "Only the DM can change a token's NPC subtype");
  }

  const hasAuraChange =
    data.auraRadius !== undefined ||
    data.auraColor !== undefined ||
    data.auraVisible !== undefined ||
    data.auraType !== undefined ||
    data.auraCondition !== undefined;
  if (userRole !== 'dm' && hasAuraChange) {
    throw new AppError(403, 'FORBIDDEN', "Only the DM can change a token's aura");
  }

  const updated = await prisma.token.update({
    where: { id: tokenId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type as TokenType }),
      ...(data.size !== undefined && { size: data.size }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl }),
      ...(data.hp !== undefined && { hp: data.hp }),
      ...(data.maxHp !== undefined && { maxHp: data.maxHp }),
      ...(data.ac !== undefined && { ac: data.ac }),
      ...(data.visionRadius !== undefined && { visionRadius: data.visionRadius }),
      ...(data.auraRadius !== undefined && { auraRadius: data.auraRadius }),
      ...(data.auraColor !== undefined && { auraColor: data.auraColor }),
      ...(data.auraVisible !== undefined && { auraVisible: data.auraVisible }),
      ...(data.auraType !== undefined && { auraType: data.auraType }),
      ...(data.auraCondition !== undefined && { auraCondition: data.auraCondition }),
      ...(data.npcSubtype !== undefined && { npcSubtype: data.npcSubtype as NpcSubtype | null }),
    },
    include: { owner: { select: { username: true } } },
  });

  return toToken(updated);
}

/**
 * Move a token to a new grid position.
 * DM can move any token; Player can only move their own; Observer cannot move any.
 */
export async function moveToken(
  tokenId: string,
  sceneId: string,
  campaignId: string,
  x: number,
  y: number,
  userId: string,
  userRole: CampaignRole,
): Promise<Token> {
  const token = await prisma.token.findFirst({ where: { id: tokenId, sceneId, campaignId } });
  if (!token) {
    throw new AppError(404, 'NOT_FOUND', 'Token not found');
  }

  assertCanWriteToken(token, userId, userRole, 'move');

  const updated = await prisma.token.update({
    where: { id: tokenId },
    data: { x, y },
    include: { owner: { select: { username: true } } },
  });

  return toToken(updated);
}

/**
 * Delete a token (DM only — enforced at route level).
 */
export async function deleteToken(
  tokenId: string,
  sceneId: string,
  campaignId: string,
): Promise<void> {
  const token = await prisma.token.findFirst({ where: { id: tokenId, sceneId, campaignId } });
  if (!token) {
    throw new AppError(404, 'NOT_FOUND', 'Token not found');
  }

  await prisma.token.delete({ where: { id: tokenId } });
}

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

function assertCanWriteToken(
  token: { ownerId: string | null },
  userId: string,
  userRole: CampaignRole,
  action: string,
): void {
  if (userRole === 'dm') return;
  if (userRole === 'player' && token.ownerId === userId) return;
  throw new AppError(403, 'FORBIDDEN', `You do not have permission to ${action} this token`);
}

// ---------------------------------------------------------------------------
// Player token provisioning (Phase 4G)
// ---------------------------------------------------------------------------

/**
 * Ensure a player token exists on the active scene for the given user.
 * Called from the campaign invite flow. Idempotent: if the user already owns
 * a player token in this campaign (e.g. they were previously a member and
 * were re-invited), that token is reused — moved onto the active scene and
 * its name refreshed to the current username — rather than creating a
 * duplicate. Otherwise a new token is created at (0, 0) with a random color.
 */
export async function createPlayerTokenForMember(
  campaignId: string,
  userId: string,
  username: string,
): Promise<Token> {
  const scene = await getOrCreateActiveScene(campaignId);

  const existing = await prisma.token.findFirst({
    where: { campaignId, ownerId: userId, type: 'player' },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    const updated = await prisma.token.update({
      where: { id: existing.id },
      data: { sceneId: scene.id, name: username },
      include: { owner: { select: { username: true } } },
    });
    return toToken(updated);
  }

  const token = await prisma.token.create({
    data: {
      sceneId: scene.id,
      campaignId,
      name: username,
      type: 'player',
      color: randomPlayerColor(),
      x: 0,
      y: 0,
      size: 1,
      ownerId: userId,
    },
    include: { owner: { select: { username: true } } },
  });

  return toToken(token);
}
