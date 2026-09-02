import type { InitiativeState, InitiativeTurnEntry } from '@vtt/shared';
import { describe, expect, it } from 'vitest';

import {
  advanceInitiativeState,
  endInitiativeForCampaign,
  reorderInitiativeForCampaign,
  sortInitiativeEntries,
} from './initiative.service.js';

function makeEntry(
  tokenId: string,
  tokenName: string,
  initiativeModifier: number,
  initiativeTotal: number,
): InitiativeTurnEntry {
  return {
    tokenId,
    tokenName,
    characterId: null,
    ownerId: null,
    initiativeModifier,
    initiativeRoll: initiativeTotal - initiativeModifier,
    initiativeTotal,
  };
}

describe('sortInitiativeEntries', () => {
  it('sorts by total descending, then modifier descending, then token name', () => {
    const sorted = sortInitiativeEntries([
      makeEntry('goblin', 'Goblin', 2, 16),
      makeEntry('wizard', 'Wizard', 1, 12),
      makeEntry('rogue', 'Rogue', 4, 16),
    ]);

    expect(sorted.map((entry) => entry.tokenId)).toEqual(['rogue', 'goblin', 'wizard']);
  });
});

describe('advanceInitiativeState', () => {
  it('advances turns and increments the round when wrapping', () => {
    const baseState: InitiativeState = {
      campaignId: 'campaign-1',
      active: true,
      activeTokenId: 'rogue',
      round: 1,
      turnIndex: 0,
      order: [makeEntry('rogue', 'Rogue', 4, 18), makeEntry('goblin', 'Goblin', 2, 12)],
    };

    const nextState = advanceInitiativeState(baseState);
    expect(nextState.activeTokenId).toBe('goblin');
    expect(nextState.round).toBe(1);

    const wrappedState = advanceInitiativeState(nextState);
    expect(wrappedState.activeTokenId).toBe('rogue');
    expect(wrappedState.round).toBe(2);
  });
});

describe('reorderInitiativeForCampaign', () => {
  it('rejects duplicate token ids', () => {
    expect(() => reorderInitiativeForCampaign('campaign-1', ['token-1', 'token-1'])).toThrow(
      'Initiative reorder must include each active combatant exactly once',
    );
  });
});

describe('endInitiativeForCampaign', () => {
  it('returns an inactive empty initiative state', () => {
    const state = endInitiativeForCampaign('campaign-1');

    expect(state).toMatchObject({
      campaignId: 'campaign-1',
      active: false,
      activeTokenId: null,
      round: 0,
      turnIndex: 0,
      order: [],
    });
  });
});
