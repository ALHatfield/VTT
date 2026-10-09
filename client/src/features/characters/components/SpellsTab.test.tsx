import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CharacterSpell, CharacterSpellSlot } from '@vtt/shared';

import { SpellsTab } from './SpellsTab';

function makeSpell(overrides: Partial<CharacterSpell> = {}): CharacterSpell {
  return {
    id: 'spell-1',
    name: 'Magic Missile',
    level: 1,
    prepared: false,
    ...overrides,
  };
}

function makeSlot(overrides: Partial<CharacterSpellSlot> = {}): CharacterSpellSlot {
  return { level: 1, max: 4, used: 1, ...overrides };
}

interface RenderOptions {
  spells?: CharacterSpell[];
  spellSlots?: CharacterSpellSlot[];
  canEdit?: boolean;
  onUpdateSpells?: (spells: CharacterSpell[]) => void;
  onUpdateSlots?: (slots: CharacterSpellSlot[]) => void;
}

function renderTab(options: RenderOptions = {}): void {
  render(
    <SpellsTab
      spells={options.spells ?? []}
      spellSlots={options.spellSlots ?? []}
      canEdit={options.canEdit ?? true}
      onUpdateSpells={options.onUpdateSpells ?? vi.fn()}
      onUpdateSlots={options.onUpdateSlots ?? vi.fn()}
    />,
  );
}

describe('SpellsTab', () => {
  describe('spell slot tracking', () => {
    it('renders one pip per slot with used state', () => {
      renderTab({ spellSlots: [makeSlot({ max: 3, used: 1 })] });

      expect(screen.getByLabelText('Level 1 slot 1 (used)')).toBeInTheDocument();
      expect(screen.getByLabelText('Level 1 slot 2 (available)')).toBeInTheDocument();
      expect(screen.getByLabelText('Level 1 slot 3 (available)')).toBeInTheDocument();
    });

    it('spends a slot when an available pip is clicked', async () => {
      const onUpdateSlots = vi.fn();
      renderTab({ spellSlots: [makeSlot({ max: 3, used: 1 })], onUpdateSlots });

      await userEvent.click(screen.getByLabelText('Level 1 slot 2 (available)'));

      expect(onUpdateSlots).toHaveBeenCalledWith([{ level: 1, max: 3, used: 2 }]);
    });

    it('unspends a slot when a used pip is clicked', async () => {
      const onUpdateSlots = vi.fn();
      renderTab({ spellSlots: [makeSlot({ max: 3, used: 2 })], onUpdateSlots });

      await userEvent.click(screen.getByLabelText('Level 1 slot 1 (used)'));

      expect(onUpdateSlots).toHaveBeenCalledWith([{ level: 1, max: 3, used: 0 }]);
    });

    it('adds a slot at a level and clamps used when max shrinks', async () => {
      const onUpdateSlots = vi.fn();
      renderTab({ spellSlots: [makeSlot({ level: 2, max: 2, used: 2 })], onUpdateSlots });

      await userEvent.click(screen.getByLabelText('Remove a level 2 slot'));

      expect(onUpdateSlots).toHaveBeenCalledWith([{ level: 2, max: 1, used: 1 }]);
    });

    it('drops a level entry entirely when max reaches zero', async () => {
      const onUpdateSlots = vi.fn();
      renderTab({ spellSlots: [makeSlot({ max: 1, used: 0 })], onUpdateSlots });

      await userEvent.click(screen.getByLabelText('Remove a level 1 slot'));

      expect(onUpdateSlots).toHaveBeenCalledWith([]);
    });

    it('resets all used slots on long rest', async () => {
      const onUpdateSlots = vi.fn();
      renderTab({
        spellSlots: [makeSlot({ level: 1, max: 4, used: 3 }), makeSlot({ level: 2, max: 2, used: 1 })],
        onUpdateSlots,
      });

      await userEvent.click(screen.getByRole('button', { name: 'Long Rest' }));

      expect(onUpdateSlots).toHaveBeenCalledWith([
        { level: 1, max: 4, used: 0 },
        { level: 2, max: 2, used: 0 },
      ]);
    });

    it('disables pips and hides max controls for read-only viewers', () => {
      renderTab({ spellSlots: [makeSlot({ max: 2, used: 0 })], canEdit: false });

      expect(screen.getByLabelText('Level 1 slot 1 (available)')).toBeDisabled();
      expect(screen.queryByLabelText('Add a level 1 slot')).not.toBeInTheDocument();
    });
  });

  describe('prepared spells', () => {
    it('toggles a spell to prepared', async () => {
      const onUpdateSpells = vi.fn();
      renderTab({ spells: [makeSpell()], onUpdateSpells });

      await userEvent.click(screen.getByLabelText('Prepare Magic Missile'));

      expect(onUpdateSpells).toHaveBeenCalledWith([
        { id: 'spell-1', name: 'Magic Missile', level: 1, prepared: true },
      ]);
    });

    it('toggles a prepared spell back to unprepared', async () => {
      const onUpdateSpells = vi.fn();
      renderTab({ spells: [makeSpell({ prepared: true })], onUpdateSpells });

      await userEvent.click(screen.getByLabelText('Unprepare Magic Missile'));

      expect(onUpdateSpells).toHaveBeenCalledWith([
        { id: 'spell-1', name: 'Magic Missile', level: 1, prepared: false },
      ]);
    });

    it('disables the prepared toggle for read-only viewers', () => {
      renderTab({ spells: [makeSpell()], canEdit: false });

      expect(screen.getByLabelText('Prepare Magic Missile')).toBeDisabled();
    });
  });

  describe('spell list management', () => {
    it('groups spells by level with labels', () => {
      renderTab({
        spells: [
          makeSpell({ id: 's1', name: 'Fire Bolt', level: 0 }),
          makeSpell({ id: 's2', name: 'Fireball', level: 3 }),
        ],
      });

      expect(screen.getByRole('heading', { name: 'Cantrips' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '3rd Level' })).toBeInTheDocument();
    });

    it('adds a spell with the chosen level', async () => {
      const onUpdateSpells = vi.fn();
      renderTab({ onUpdateSpells });

      await userEvent.type(screen.getByLabelText('Spell name'), 'Shield');
      await userEvent.selectOptions(screen.getByLabelText('Spell level'), '1');
      await userEvent.click(screen.getByRole('button', { name: 'Add Spell' }));

      expect(onUpdateSpells).toHaveBeenCalledTimes(1);
      const next = onUpdateSpells.mock.calls[0][0] as CharacterSpell[];
      expect(next).toHaveLength(1);
      expect(next[0]).toMatchObject({ name: 'Shield', level: 1, prepared: false });
      expect(next[0].id).toBeTruthy();
    });

    it('removes a spell', async () => {
      const onUpdateSpells = vi.fn();
      renderTab({
        spells: [makeSpell(), makeSpell({ id: 'spell-2', name: 'Shield' })],
        onUpdateSpells,
      });

      await userEvent.click(screen.getByLabelText('Remove Magic Missile'));

      expect(onUpdateSpells).toHaveBeenCalledWith([
        { id: 'spell-2', name: 'Shield', level: 1, prepared: false },
      ]);
    });
  });

  describe('drag-and-drop reordering', () => {
    const spellA = makeSpell({ id: 'a', name: 'Alpha', level: 1 });
    const spellB = makeSpell({ id: 'b', name: 'Beta', level: 1 });
    const spellC = makeSpell({ id: 'c', name: 'Gamma', level: 2 });

    it('reorders spells within the same level', () => {
      const onUpdateSpells = vi.fn();
      renderTab({ spells: [spellA, spellB, spellC], onUpdateSpells });

      const rows = screen.getAllByRole('listitem');
      // Drag Beta onto Alpha → Beta inserted before Alpha
      fireEvent.dragStart(rows[1]);
      fireEvent.dragOver(rows[0]);
      fireEvent.drop(rows[0]);

      expect(onUpdateSpells).toHaveBeenCalledWith([spellB, spellA, spellC]);
    });

    it('moves a spell to the end of its level group when dragged down', () => {
      const onUpdateSpells = vi.fn();
      renderTab({ spells: [spellA, spellB, spellC], onUpdateSpells });

      const rows = screen.getAllByRole('listitem');
      // Drag Alpha onto Beta (downward) → Alpha lands after Beta
      fireEvent.dragStart(rows[0]);
      fireEvent.drop(rows[1]);

      expect(onUpdateSpells).toHaveBeenCalledWith([spellB, spellA, spellC]);
    });

    it('ignores a drop onto the dragged spell itself', () => {
      const onUpdateSpells = vi.fn();
      renderTab({ spells: [spellA, spellB], onUpdateSpells });

      const rows = screen.getAllByRole('listitem');
      fireEvent.dragStart(rows[0]);
      fireEvent.drop(rows[0]);

      expect(onUpdateSpells).not.toHaveBeenCalled();
    });

    it('ignores drops across different levels', () => {
      const onUpdateSpells = vi.fn();
      renderTab({ spells: [spellA, spellC], onUpdateSpells });

      const rows = screen.getAllByRole('listitem');
      fireEvent.dragStart(rows[1]); // Gamma (level 2)
      fireEvent.drop(rows[0]); // Alpha (level 1)

      expect(onUpdateSpells).not.toHaveBeenCalled();
    });

    it('does not allow dragging for read-only viewers', () => {
      renderTab({ spells: [spellA, spellB], canEdit: false });

      const rows = screen.getAllByRole('listitem');
      expect(rows[0]).toHaveAttribute('draggable', 'false');
    });
  });
});
