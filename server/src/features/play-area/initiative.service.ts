import { randomInt } from 'node:crypto';

import type { InitiativeState, InitiativeTurnEntry } from '@vtt/shared';
import { calculateModifier } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';

interface CharacterAbilityScores {
  dexterity: number;
}

const initiativeStates = new Map<string, InitiativeState>();

function hasDexterityScore(value: unknown): value is CharacterAbilityScores {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dexterity' in value &&
    typeof value.dexterity === 'number'
  );
}

function rollD20(): number {
  return randomInt(1, 21);
}

export function sortInitiativeEntries(entries: InitiativeTurnEntry[]): InitiativeTurnEntry[] {
  return [...entries].sort((left, right) => {
    const totalDiff = (right.initiativeTotal ?? -Infinity) - (left.initiativeTotal ?? -Infinity);
    if (totalDiff !== 0) return totalDiff;

    const modifierDiff = right.initiativeModifier - left.initiativeModifier;
    if (modifierDiff !== 0) return modifierDiff;

    return left.tokenName.localeCompare(right.tokenName);
  });
}

export function advanceInitiativeState(state: InitiativeState): InitiativeState {
  if (!state.active || state.order.length === 0) return state;

  const nextTurnIndex = (state.turnIndex + 1) % state.order.length;
  const round = nextTurnIndex === 0 ? state.round + 1 : state.round;

  return {
    ...state,
    activeTokenId: state.order[nextTurnIndex]?.tokenId ?? null,
    round,
    turnIndex: nextTurnIndex,
  };
}

export async function startInitiativeForCampaign(
  campaignId: string,
  tokenIds?: string[],
): Promise<InitiativeState> {
  if (tokenIds && new Set(tokenIds).size !== tokenIds.length) {
    throw new Error('Initiative start token list must include unique combatants');
  }

  const activeScene = await prisma.scene.findFirst({
    where: { campaignId, isActive: true },
    select: { id: true },
  });

  if (!activeScene) {
    const emptyState = createEmptyInitiativeState(campaignId);
    initiativeStates.set(campaignId, emptyState);
    return emptyState;
  }

  const tokens = await prisma.token.findMany({
    where: {
      campaignId,
      sceneId: activeScene.id,
      ...(tokenIds ? { id: { in: tokenIds } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, ownerId: true },
  });

  if (tokenIds && tokens.length !== tokenIds.length) {
    throw new Error('Initiative start token list must match active scene combatants');
  }

  const ownerIds = [
    ...new Set(tokens.map((token) => token.ownerId).filter((id): id is string => id !== null)),
  ];
  const characters = await prisma.character.findMany({
    where: { campaignId, userId: { in: ownerIds } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, userId: true, abilityScores: true },
  });
  const characterByOwnerId = new Map<string, (typeof characters)[number]>();
  for (const character of characters) {
    if (!characterByOwnerId.has(character.userId)) {
      characterByOwnerId.set(character.userId, character);
    }
  }

  const entries = tokens.map((token): InitiativeTurnEntry => {
    const character = token.ownerId ? characterByOwnerId.get(token.ownerId) : undefined;
    const initiativeModifier = hasDexterityScore(character?.abilityScores)
      ? calculateModifier(character.abilityScores.dexterity)
      : 0;
    const initiativeRoll = rollD20();

    return {
      tokenId: token.id,
      tokenName: token.name,
      characterId: character?.id ?? null,
      ownerId: token.ownerId,
      initiativeModifier,
      initiativeRoll,
      initiativeTotal: initiativeRoll + initiativeModifier,
    };
  });

  const order = sortInitiativeEntries(entries);
  const state: InitiativeState = {
    campaignId,
    active: true,
    activeTokenId: order[0]?.tokenId ?? null,
    round: 1,
    turnIndex: 0,
    order,
  };

  initiativeStates.set(campaignId, state);
  return state;
}

export function advanceInitiativeForCampaign(campaignId: string): InitiativeState {
  const state = initiativeStates.get(campaignId) ?? createEmptyInitiativeState(campaignId);
  const nextState = advanceInitiativeState(state);
  initiativeStates.set(campaignId, nextState);
  return nextState;
}

export function endInitiativeForCampaign(campaignId: string): InitiativeState {
  const state = createEmptyInitiativeState(campaignId);
  initiativeStates.set(campaignId, state);
  return state;
}

export function reorderInitiativeForCampaign(
  campaignId: string,
  tokenIds: string[],
): InitiativeState {
  const state = initiativeStates.get(campaignId) ?? createEmptyInitiativeState(campaignId);
  if (new Set(tokenIds).size !== tokenIds.length) {
    throw new Error('Initiative reorder must include each active combatant exactly once');
  }
  const entriesByTokenId = new Map(state.order.map((entry) => [entry.tokenId, entry]));
  const reorderedEntries = tokenIds.map((tokenId) => entriesByTokenId.get(tokenId));

  if (
    reorderedEntries.some((entry) => entry === undefined) ||
    reorderedEntries.length !== state.order.length
  ) {
    throw new Error('Initiative reorder must include each active combatant exactly once');
  }

  const order = reorderedEntries.filter(
    (entry): entry is InitiativeTurnEntry => entry !== undefined,
  );
  const turnIndex = Math.max(
    0,
    order.findIndex((entry) => entry.tokenId === state.activeTokenId),
  );
  const nextState: InitiativeState = {
    ...state,
    activeTokenId: order[turnIndex]?.tokenId ?? null,
    turnIndex,
    order,
  };

  initiativeStates.set(campaignId, nextState);
  return nextState;
}

export function getInitiativeState(campaignId: string): InitiativeState | null {
  return initiativeStates.get(campaignId) ?? null;
}

function createEmptyInitiativeState(campaignId: string): InitiativeState {
  return {
    campaignId,
    active: false,
    activeTokenId: null,
    round: 0,
    turnIndex: 0,
    order: [],
  };
}
