import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AbilityScores, CharacterAttack } from '@vtt/shared';

import { StatsTab } from './StatsTab';

// STR +3, DEX +2, CON +1, INT 0, WIS +1, CHA -1
const ABILITY_SCORES: AbilityScores = {
  strength: 16,
  dexterity: 14,
  constitution: 12,
  intelligence: 10,
  wisdom: 13,
  charisma: 8,
};

const LONGSWORD: CharacterAttack = {
  id: '9a3cfa5e-0000-4000-8000-000000000001',
  name: 'Longsword',
  ability: 'strength',
  proficient: true,
  damageDice: '1d8',
};

const PROFICIENCY_BONUS = 3;

describe('StatsTab (Phase 6C interactive rolling)', () => {
  const onRoll = vi.fn();
  const onToggleSkill = vi.fn();
  const onAddAttack = vi.fn();
  const onRemoveAttack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderTab(overrides?: Partial<Parameters<typeof StatsTab>[0]>): void {
    render(
      <StatsTab
        abilityScores={ABILITY_SCORES}
        proficiencyBonus={PROFICIENCY_BONUS}
        skillProficiencies={['stealth']}
        attacks={[LONGSWORD]}
        canRoll
        canEdit
        onRoll={onRoll}
        onToggleSkill={onToggleSkill}
        onAddAttack={onAddAttack}
        onRemoveAttack={onRemoveAttack}
        {...overrides}
      />,
    );
  }

  it('rolls d20 + ability modifier when an ability card is clicked', async () => {
    renderTab();
    await userEvent.click(screen.getByTitle('Roll STR check'));
    expect(onRoll).toHaveBeenCalledWith('d20+3', 'STR');
  });

  it('rolls with advantage when the advantage mode is selected', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('radio', { name: 'Advantage' }));
    await userEvent.click(screen.getByTitle('Roll STR check'));
    expect(onRoll).toHaveBeenCalledWith('d20+3 advantage', 'STR');
  });

  it('rolls with disadvantage when the disadvantage mode is selected', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('radio', { name: 'Disadvantage' }));
    await userEvent.click(screen.getByTitle('Roll CHA check'));
    expect(onRoll).toHaveBeenCalledWith('d20-1 disadvantage', 'CHA');
  });

  it('adds the proficiency bonus to proficient skill rolls', async () => {
    renderTab();
    // Stealth: DEX +2 + proficiency +3 = +5
    await userEvent.click(screen.getByTitle('Roll Stealth'));
    expect(onRoll).toHaveBeenCalledWith('d20+5', 'Stealth');
  });

  it('rolls non-proficient skills with the bare ability modifier', async () => {
    renderTab();
    // Athletics: STR +3, not proficient
    await userEvent.click(screen.getByTitle('Roll Athletics'));
    expect(onRoll).toHaveBeenCalledWith('d20+3', 'Athletics');
  });

  it('toggles proficiency instead of rolling while editing skills', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: 'Edit proficiencies' }));
    await userEvent.click(screen.getByTitle('Toggle Athletics proficiency'));
    expect(onToggleSkill).toHaveBeenCalledWith('athletics');
    expect(onRoll).not.toHaveBeenCalled();
  });

  it('rolls an attack with ability modifier plus proficiency', async () => {
    renderTab();
    // Longsword: STR +3 + proficiency +3 = +6
    await userEvent.click(screen.getByRole('button', { name: 'Attack +6' }));
    expect(onRoll).toHaveBeenCalledWith('d20+6', 'Longsword attack');
  });

  it('applies the advantage mode to attack rolls but not damage', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('radio', { name: 'Advantage' }));
    await userEvent.click(screen.getByRole('button', { name: 'Attack +6' }));
    expect(onRoll).toHaveBeenCalledWith('d20+6 advantage', 'Longsword attack');

    await userEvent.click(screen.getByRole('button', { name: 'Damage 1d8+3' }));
    expect(onRoll).toHaveBeenCalledWith('1d8+3', 'Longsword damage');
  });

  it('rolls damage dice plus the ability modifier', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: 'Damage 1d8+3' }));
    expect(onRoll).toHaveBeenCalledWith('1d8+3', 'Longsword damage');
  });

  it('rolls initiative with the dexterity modifier', async () => {
    renderTab();
    await userEvent.click(screen.getByTitle('Roll initiative'));
    expect(onRoll).toHaveBeenCalledWith('d20+2', 'Initiative');
  });

  it('disables roll buttons while disconnected', () => {
    renderTab({ canRoll: false });
    expect(screen.getByTitle('Roll STR check')).toBeDisabled();
    expect(screen.getByTitle('Roll Stealth')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Attack +6' })).toBeDisabled();
  });

  it('adds an attack from the form', async () => {
    renderTab();
    await userEvent.type(screen.getByLabelText('Attack name'), 'Dagger');
    await userEvent.selectOptions(screen.getByLabelText('Attack ability'), 'dexterity');
    await userEvent.clear(screen.getByLabelText('Damage dice'));
    await userEvent.type(screen.getByLabelText('Damage dice'), '1d4');
    await userEvent.click(screen.getByRole('button', { name: 'Add attack' }));

    expect(onAddAttack).toHaveBeenCalledTimes(1);
    const attack = onAddAttack.mock.calls[0][0] as CharacterAttack;
    expect(attack).toMatchObject({
      name: 'Dagger',
      ability: 'dexterity',
      proficient: true,
      damageDice: '1d4',
    });
    expect(attack.id).toBeTruthy();
  });

  it('rejects invalid damage dice in the attack form', async () => {
    renderTab();
    await userEvent.type(screen.getByLabelText('Attack name'), 'Club');
    await userEvent.clear(screen.getByLabelText('Damage dice'));
    await userEvent.type(screen.getByLabelText('Damage dice'), 'banana');
    await userEvent.click(screen.getByRole('button', { name: 'Add attack' }));

    expect(onAddAttack).not.toHaveBeenCalled();
    expect(screen.getByText('Damage dice must look like "1d8" or "2d6"')).toBeInTheDocument();
  });

  it('removes an attack', async () => {
    renderTab();
    await userEvent.click(screen.getByTitle('Remove Longsword'));
    expect(onRemoveAttack).toHaveBeenCalledWith(LONGSWORD.id);
  });

  it('hides editing controls for non-owners', () => {
    renderTab({ canEdit: false });
    expect(screen.queryByRole('button', { name: 'Edit proficiencies' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add attack' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Remove Longsword')).not.toBeInTheDocument();
  });
});
