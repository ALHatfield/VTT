import type { Character, CharacterCreateInput, CharacterUpdateInput } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';

/**
 * Map a raw Prisma character to the shared Character type
 */
function toCharacter(raw: {
  id: string;
  campaignId: string;
  userId: string;
  name: string;
  race: string;
  class: string;
  level: number;
  abilityScores: unknown;
  hp: number;
  maxHp: number;
  ac: number;
  proficiencyBonus: number;
  speed: number;
  portraitUrl: string | null;
  biography: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Character {
  return {
    id: raw.id,
    campaignId: raw.campaignId,
    userId: raw.userId,
    name: raw.name,
    race: raw.race,
    class: raw.class,
    level: raw.level,
    abilityScores: raw.abilityScores as Character['abilityScores'],
    hp: raw.hp,
    maxHp: raw.maxHp,
    ac: raw.ac,
    proficiencyBonus: raw.proficiencyBonus,
    speed: raw.speed,
    portraitUrl: raw.portraitUrl,
    biography: raw.biography,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * List all characters in a campaign.
 * Players see all characters; the caller may filter by role at the route level.
 */
export async function listCharacters(campaignId: string): Promise<Character[]> {
  const characters = await prisma.character.findMany({
    where: { campaignId },
    orderBy: { name: 'asc' },
  });

  return characters.map(toCharacter);
}

/**
 * Get a single character by ID within a campaign
 */
export async function getCharacter(
  campaignId: string,
  characterId: string,
): Promise<Character | null> {
  const character = await prisma.character.findFirst({
    where: { id: characterId, campaignId },
  });

  return character ? toCharacter(character) : null;
}

/**
 * Create a new character in a campaign
 */
export async function createCharacter(
  campaignId: string,
  userId: string,
  data: CharacterCreateInput,
): Promise<Character> {
  const character = await prisma.character.create({
    data: {
      campaignId,
      userId,
      name: data.name,
      race: data.race,
      class: data.class,
      level: data.level,
      abilityScores: data.abilityScores,
      hp: data.hp,
      maxHp: data.maxHp,
      ac: data.ac,
      proficiencyBonus: data.proficiencyBonus,
      speed: data.speed,
      portraitUrl: data.portraitUrl ?? null,
      biography: data.biography ?? null,
    },
  });

  return toCharacter(character);
}

/**
 * Update a character. Caller must verify ownership/DM at route level.
 */
export async function updateCharacter(
  campaignId: string,
  characterId: string,
  data: CharacterUpdateInput,
): Promise<Character | null> {
  // Ensure the character belongs to this campaign
  const existing = await prisma.character.findFirst({
    where: { id: characterId, campaignId },
  });
  if (!existing) return null;

  const updated = await prisma.character.update({
    where: { id: characterId },
    data,
  });

  return toCharacter(updated);
}

/**
 * Quick HP update for a character (combat use)
 */
export async function updateCharacterHp(
  campaignId: string,
  characterId: string,
  hp: number,
): Promise<Character | null> {
  const existing = await prisma.character.findFirst({
    where: { id: characterId, campaignId },
  });
  if (!existing) return null;

  const updated = await prisma.character.update({
    where: { id: characterId },
    data: { hp },
  });

  return toCharacter(updated);
}

/**
 * Delete a character. DM only — enforced at route level.
 */
export async function deleteCharacter(
  campaignId: string,
  characterId: string,
): Promise<boolean> {
  const existing = await prisma.character.findFirst({
    where: { id: characterId, campaignId },
  });
  if (!existing) return false;

  await prisma.character.delete({ where: { id: characterId } });
  return true;
}
