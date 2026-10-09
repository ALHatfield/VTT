import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CampaignPlayer, Character, CharacterToken } from '@vtt/shared';

import { MemberLinkControls } from './MemberLinkControls';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    campaignId: 'camp-1',
    userId: 'user-1',
    name: 'Thorin',
    race: 'Dwarf',
    class: 'Fighter',
    level: 5,
    abilityScores: {
      strength: 16,
      dexterity: 14,
      constitution: 12,
      intelligence: 10,
      wisdom: 13,
      charisma: 8,
    },
    hp: 44,
    maxHp: 44,
    ac: 18,
    proficiencyBonus: 3,
    speed: 25,
    skillProficiencies: [],
    attacks: [],
    spells: [],
    spellSlots: [],
    portraitUrl: null,
    biography: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMember(overrides: Partial<CampaignPlayer> = {}): CampaignPlayer {
  return {
    id: 'member-1',
    campaignId: 'camp-1',
    userId: 'user-1',
    role: 'player',
    username: 'alice',
    color: null,
    joinedAt: new Date(),
    ...overrides,
  };
}

const ALICE = makeMember();
const BOB = makeMember({ id: 'member-2', userId: 'user-2', username: 'bob' });
const MEMBERS: CampaignPlayer[] = [
  makeMember({ id: 'member-dm', userId: 'dm-1', role: 'dm', username: 'dungeon-master' }),
  ALICE,
  BOB,
];

const LINK: CharacterToken = {
  id: 'link-1',
  campaignId: 'camp-1',
  characterId: 'char-1',
  tokenId: 'tok-1',
  createdAt: new Date().toISOString(),
};

interface SetupOptions {
  member?: CampaignPlayer;
  isDm?: boolean;
  characters?: Character[];
  links?: CharacterToken[];
}

function setup(options: SetupOptions = {}): {
  onUnlink: ReturnType<typeof vi.fn>;
  onAssign: ReturnType<typeof vi.fn>;
  onSetPortrait: ReturnType<typeof vi.fn>;
} {
  const onUnlink = vi.fn().mockResolvedValue(undefined);
  const onAssign = vi.fn().mockResolvedValue(undefined);
  const onSetPortrait = vi.fn().mockResolvedValue(undefined);

  render(
    <MemberLinkControls
      member={options.member ?? ALICE}
      isDm={options.isDm ?? true}
      members={MEMBERS}
      characters={options.characters ?? [makeCharacter()]}
      links={options.links ?? []}
      onUnlink={onUnlink}
      onAssign={onAssign}
      onSetPortrait={onSetPortrait}
    />,
  );

  return { onUnlink, onAssign, onSetPortrait };
}

describe('MemberLinkControls', () => {
  it("pre-selects the member's own character", () => {
    setup();

    expect(screen.getByLabelText('Select character for alice')).toHaveValue('char-1');
  });

  it('calls onAssign when the DM picks a character for a member', async () => {
    const user = userEvent.setup();
    const { onAssign } = setup({ member: BOB });

    await user.selectOptions(screen.getByLabelText('Select character for bob'), 'char-1');

    expect(onAssign).toHaveBeenCalledWith('char-1', 'user-2');
  });

  it('calls onAssign when a player picks a character for themselves', async () => {
    const user = userEvent.setup();
    const { onAssign } = setup({
      isDm: false,
      characters: [
        makeCharacter(),
        makeCharacter({ id: 'char-2', name: 'Elara' }),
      ],
    });

    await user.selectOptions(screen.getByLabelText('Select character for alice'), 'char-2');

    expect(onAssign).toHaveBeenCalledWith('char-2', 'user-1');
  });

  it('calls onUnlink when "no character" is selected while linked', async () => {
    const user = userEvent.setup();
    const { onUnlink } = setup({ links: [LINK] });

    await user.selectOptions(screen.getByLabelText('Select character for alice'), '');

    expect(onUnlink).toHaveBeenCalledWith('link-1');
  });

  it('shows a linked badge when the character is linked', () => {
    setup({ links: [LINK] });

    expect(screen.getByText('● linked')).toBeInTheDocument();
  });

  it('labels global template characters and offers them to players', () => {
    setup({
      isDm: false,
      characters: [makeCharacter({ id: 'tmpl-1', campaignId: null, name: 'Elara' })],
    });

    expect(screen.getByRole('option', { name: 'Elara (template)' })).toBeInTheDocument();
  });

  it('disables the image picker for template characters', () => {
    setup({
      isDm: false,
      characters: [makeCharacter({ id: 'tmpl-1', campaignId: null, name: 'Elara' })],
    });

    expect(screen.getByLabelText('Choose token image for alice')).toBeDisabled();
  });

  it('sets the portrait via the image picker', async () => {
    const user = userEvent.setup();
    const { onSetPortrait } = setup();

    await user.click(screen.getByLabelText('Choose token image for alice'));
    await user.click(screen.getByLabelText('Token image /tokens/token2.png'));

    expect(onSetPortrait).toHaveBeenCalledWith('char-1', '/tokens/token2.png');
  });
});
