import { Prisma } from '@prisma/client';
import type { CampaignRole, CharacterToken, Token } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { mapTokenRow } from '../../shared/sync/character-token-sync.js';

function toCharacterToken(raw: {
  id: string;
  campaignId: string;
  characterId: string;
  tokenId: string;
  createdAt: Date;
}): CharacterToken {
  return {
    id: raw.id,
    campaignId: raw.campaignId,
    characterId: raw.characterId,
    tokenId: raw.tokenId,
    createdAt: raw.createdAt.toISOString(),
  };
}

/**
 * List all character-token links in a campaign
 */
export async function listCharacterTokens(campaignId: string): Promise<CharacterToken[]> {
  const links = await prisma.characterToken.findMany({
    where: { campaignId },
    orderBy: { createdAt: 'asc' },
  });

  return links.map(toCharacterToken);
}

export interface LinkResult {
  link: CharacterToken;
  /** Token after character display fields were copied onto it */
  token: Token;
}

type CharacterRow = NonNullable<Awaited<ReturnType<typeof prisma.character.findFirst>>>;
type Db = Prisma.TransactionClient;

/**
 * Clone a global template character into a campaign for a specific owner.
 * Templates (campaignId null) are shared blueprints — each campaign gets its
 * own editable copy so HP and edits never leak across campaigns.
 */
async function cloneTemplateCharacter(
  db: Db,
  template: CharacterRow,
  campaignId: string,
  ownerUserId: string,
): Promise<CharacterRow> {
  return db.character.create({
    data: {
      campaignId,
      userId: ownerUserId,
      name: template.name,
      race: template.race,
      class: template.class,
      level: template.level,
      abilityScores: template.abilityScores as Prisma.InputJsonValue,
      hp: template.hp,
      maxHp: template.maxHp,
      ac: template.ac,
      proficiencyBonus: template.proficiencyBonus,
      speed: template.speed,
      skillProficiencies: template.skillProficiencies as Prisma.InputJsonValue,
      attacks: template.attacks as Prisma.InputJsonValue,
      spells: template.spells as Prisma.InputJsonValue,
      spellSlots: template.spellSlots as Prisma.InputJsonValue,
      portraitUrl: template.portraitUrl,
      biography: template.biography,
    },
  });
}

/**
 * Replace-link a character to a token inside an open transaction: any existing
 * link on either side is removed, the token adopts the character's display
 * fields, and token ownership follows Character.userId.
 */
async function applyLink(
  tx: Db,
  campaignId: string,
  character: CharacterRow,
  tokenId: string,
): Promise<{ id: string; campaignId: string; characterId: string; tokenId: string; createdAt: Date }> {
  await tx.characterToken.deleteMany({
    where: { OR: [{ characterId: character.id }, { tokenId }] },
  });

  const created = await tx.characterToken.create({
    data: { campaignId, characterId: character.id, tokenId },
  });

  await tx.token.update({
    where: { id: tokenId },
    data: {
      ownerId: character.userId,
      name: character.name,
      iconUrl: character.portraitUrl,
      hp: character.hp,
      maxHp: character.maxHp,
      ac: character.ac,
    },
  });

  return created;
}

/** Map a P2002 unique-constraint race to a client-visible conflict. */
function toConflictError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new AppError(409, 'CONFLICT', 'Link was changed concurrently — try again');
  }
  throw err;
}

async function fetchSyncedToken(tokenId: string): Promise<Token> {
  const row = await prisma.token.findUnique({
    where: { id: tokenId },
    include: { owner: { select: { username: true } } },
  });
  if (!row) {
    throw new AppError(500, 'SYNC_FAILED', 'Failed to sync character onto token');
  }
  return mapTokenRow(row);
}

/**
 * Link a character to a token, replacing any existing link on either side.
 *
 * Permissions: the DM links anything; a player may only link their own
 * character (Character.userId) to their own token (Token.ownerId).
 *
 * On link the token adopts the character's display fields (name, portrait,
 * HP, max HP, AC) and its ownerId follows Character.userId so the token
 * ownership chain stays intact.
 *
 * Linking a global template (campaignId null) first clones it into the
 * campaign for the token's owner; the clone is what gets linked.
 */
export async function linkCharacterToken(
  campaignId: string,
  characterId: string,
  tokenId: string,
  userId: string,
  userRole: CampaignRole,
): Promise<LinkResult> {
  const character = await prisma.character.findFirst({
    where: { id: characterId, OR: [{ campaignId }, { campaignId: null }] },
  });
  if (!character) {
    throw new AppError(404, 'NOT_FOUND', 'Character not found');
  }

  const token = await prisma.token.findFirst({
    where: { id: tokenId, campaignId },
  });
  if (!token) {
    throw new AppError(404, 'NOT_FOUND', 'Token not found');
  }

  const isTemplate = character.campaignId === null;

  if (userRole !== 'dm') {
    // Anyone may claim a template; campaign characters must be their own
    if (!isTemplate && character.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only link your own character');
    }
    if (token.ownerId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only link to your own token');
    }
  }

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const target = isTemplate
        ? await cloneTemplateCharacter(tx, character!, campaignId, token.ownerId ?? userId)
        : character!;
      const raw = await applyLink(tx, campaignId, target, token.id);
      return raw;
    });
  } catch (err) {
    toConflictError(err);
  }

  return { link: toCharacterToken(result), token: await fetchSyncedToken(token.id) };
}

/**
 * Remove a character-token link.
 * Permissions: DM, or the owner of the linked character.
 */
export async function unlinkCharacterToken(
  campaignId: string,
  linkId: string,
  userId: string,
  userRole: CampaignRole,
): Promise<CharacterToken> {
  const link = await prisma.characterToken.findFirst({
    where: { id: linkId, campaignId },
    include: { character: true },
  });
  if (!link) {
    throw new AppError(404, 'NOT_FOUND', 'Link not found');
  }

  if (userRole !== 'dm' && link.character.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only unlink your own character');
  }

  await prisma.characterToken.delete({ where: { id: link.id } });

  return toCharacterToken(link);
}

export interface AssignmentResult {
  characterId: string;
  userId: string;
  previousUserId: string;
  /** Auto-created link to the assignee's player token, when they have one */
  link: CharacterToken | null;
  /** The assignee's token after display sync, when a link was created */
  token: Token | null;
}

/**
 * Assign a character to a user and auto-link it to their player token —
 * the player's token is implied, so no separate linking step is needed.
 *
 * Permissions: the DM assigns anything; a player may only assign themselves,
 * and only their own characters or global templates (no claiming another
 * player's character). Assigning a template clones it into the campaign for
 * the assignee; the clone's id is returned as `characterId`.
 */
export async function assignCharacter(
  campaignId: string,
  characterId: string,
  userId: string,
  callerId: string,
  callerRole: CampaignRole,
): Promise<AssignmentResult> {
  const character = await prisma.character.findFirst({
    where: { id: characterId, OR: [{ campaignId }, { campaignId: null }] },
  });
  if (!character) {
    throw new AppError(404, 'NOT_FOUND', 'Character not found');
  }

  const isTemplate = character.campaignId === null;

  // Players may claim templates or re-link their own characters — never someone else's
  if (callerRole !== 'dm' && !isTemplate && character.userId !== callerId) {
    throw new AppError(403, 'FORBIDDEN', "You cannot assign another player's character");
  }

  const member = await prisma.campaignPlayer.findFirst({
    where: { campaignId, userId },
  });
  if (!member) {
    throw new AppError(400, 'INVALID_ASSIGNEE', 'Target user is not a campaign member');
  }
  if (member.role === 'observer') {
    throw new AppError(400, 'INVALID_ASSIGNEE', 'Observers cannot be assigned characters');
  }

  const previousUserId = character.userId;

  let outcome;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      let target = character;
      if (isTemplate) {
        target = await cloneTemplateCharacter(tx, character, campaignId, userId);
      } else if (character.userId !== userId) {
        target = await tx.character.update({
          where: { id: characterId },
          data: { userId },
        });
      }

      // Auto-link to the assignee's player token — it's implicitly theirs
      const playerToken = await tx.token.findFirst({
        where: { campaignId, ownerId: userId, type: 'player' },
        orderBy: { createdAt: 'asc' },
      });
      if (!playerToken) {
        return { characterId: target.id, rawLink: null, tokenId: null };
      }

      const rawLink = await applyLink(tx, campaignId, target, playerToken.id);
      return { characterId: target.id, rawLink, tokenId: playerToken.id };
    });
  } catch (err) {
    toConflictError(err);
  }

  if (!outcome.rawLink || !outcome.tokenId) {
    return { characterId: outcome.characterId, userId, previousUserId, link: null, token: null };
  }

  return {
    characterId: outcome.characterId,
    userId,
    previousUserId,
    link: toCharacterToken(outcome.rawLink),
    token: await fetchSyncedToken(outcome.tokenId),
  };
}
