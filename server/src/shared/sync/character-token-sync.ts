import type { AuraCondition, AuraType, NpcSubtype, Token, TokenType } from '@vtt/shared';

import { prisma } from '../db/prisma.js';

/**
 * Character ↔ token HP/display sync (Phase 6B).
 *
 * Lives in server/src/shared because both the characters feature (sheet → token)
 * and the play-area feature (token → sheet) need it, and features must not
 * import from each other directly.
 */

interface RawToken {
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
}

/** Map a raw Prisma token row (with optional owner) to the shared Token type. */
export function mapTokenRow(raw: RawToken): Token {
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

/**
 * Copy a character's display fields (name, portrait, HP, max HP, AC) onto its
 * linked token. Returns the updated token, or null when the character has no link.
 */
export async function syncCharacterToLinkedToken(
  campaignId: string,
  characterId: string,
): Promise<Token | null> {
  const link = await prisma.characterToken.findFirst({
    where: { campaignId, characterId },
    include: { character: true },
  });
  if (!link) return null;

  const { character } = link;
  const updated = await prisma.token.update({
    where: { id: link.tokenId },
    data: {
      name: character.name,
      iconUrl: character.portraitUrl,
      hp: character.hp,
      maxHp: character.maxHp,
      ac: character.ac,
    },
    include: { owner: { select: { username: true } } },
  });

  return mapTokenRow(updated);
}

/** Result of a token → character HP sync. */
export interface TokenHpSyncResult {
  characterId: string;
  hp: number;
  maxHp: number;
  /** Set when the token's HP was clamped back to the character's max HP */
  correctedTokenHp?: number;
}

/**
 * Propagate a token HP change to its linked character, clamping to the
 * character's [0, maxHp] range. When clamping changes the value, the token is
 * corrected to match so the two never diverge. Returns null when the token has
 * no link.
 */
export async function syncTokenHpToCharacter(
  campaignId: string,
  tokenId: string,
  hp: number,
): Promise<TokenHpSyncResult | null> {
  const link = await prisma.characterToken.findFirst({
    where: { campaignId, tokenId },
    include: { character: true },
  });
  if (!link) return null;

  const clampedHp = Math.min(Math.max(hp, 0), link.character.maxHp);
  const updated = await prisma.character.update({
    where: { id: link.characterId },
    data: { hp: clampedHp },
  });

  const result: TokenHpSyncResult = {
    characterId: updated.id,
    hp: updated.hp,
    maxHp: updated.maxHp,
  };

  if (clampedHp !== hp) {
    await prisma.token.update({
      where: { id: tokenId },
      data: { hp: clampedHp },
    });
    result.correctedTokenHp = clampedHp;
  }

  return result;
}
