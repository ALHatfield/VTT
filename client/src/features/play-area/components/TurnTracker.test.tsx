import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { InitiativeState, Token } from '@vtt/shared';

import { TurnTracker } from './TurnTracker';

const token: Token = {
  id: 'token-1',
  sceneId: 'scene-1',
  campaignId: 'campaign-1',
  ownerId: 'user-1',
  ownerName: 'Player',
  name: 'Rogue',
  type: 'player',
  x: 0,
  y: 0,
  size: 1,
  color: '#4a9eff',
  iconUrl: null,
  hp: null,
  maxHp: null,
  ac: null,
  visionRadius: 6,
  auraRadius: null,
  auraColor: null,
  auraVisible: false,
  auraType: null,
  auraCondition: null,
  npcSubtype: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const initiativeState: InitiativeState = {
  campaignId: 'campaign-1',
  active: true,
  activeTokenId: 'token-1',
  round: 1,
  turnIndex: 0,
  order: [
    {
      tokenId: 'token-1',
      tokenName: 'Rogue',
      characterId: 'character-1',
      ownerId: 'user-1',
      initiativeModifier: 3,
      initiativeRoll: 14,
      initiativeTotal: 17,
    },
  ],
};

describe('TurnTracker', () => {
  it('starts initiative with selected token ids for the DM', () => {
    const onStart = vi.fn();

    render(
      <TurnTracker
        initiativeState={null}
        tokens={[token]}
        selectedTokenIds={new Set(['token-1'])}
        role="dm"
        isConnected={true}
        onStart={onStart}
        onAdvance={() => undefined}
        onEnd={() => undefined}
        onReorder={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Selected' }));

    expect(onStart).toHaveBeenCalledWith(['token-1']);
  });

  it('renders active order and advances turns', () => {
    const onAdvance = vi.fn();
    const onEnd = vi.fn();

    render(
      <TurnTracker
        initiativeState={initiativeState}
        tokens={[token]}
        selectedTokenIds={new Set()}
        role="dm"
        isConnected={true}
        onStart={() => undefined}
        onAdvance={onAdvance}
        onEnd={onEnd}
        onReorder={() => undefined}
      />,
    );

    expect(screen.getByText('Rogue')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next Turn' }));

    expect(onAdvance).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'End Combat' }));

    expect(onEnd).toHaveBeenCalledOnce();
  });
});
