import type { ReactElement } from 'react';
import { useState } from 'react';

import type { CharacterSpell, CharacterSpellSlot } from '@vtt/shared';
import {
    CHARACTER_MAX_SPELLS,
    SPELL_LEVEL_LABELS,
    SPELL_LEVEL_MAX,
    SPELL_NAME_MAX_LENGTH,
    SPELL_SLOT_LEVEL_MIN,
    SPELL_SLOT_MAX_PER_LEVEL,
} from '@vtt/shared';

import styles from './SpellsTab.module.css';

const SLOT_LEVELS = Array.from(
  { length: SPELL_LEVEL_MAX - SPELL_SLOT_LEVEL_MIN + 1 },
  (_, i) => SPELL_SLOT_LEVEL_MIN + i,
);
const SPELL_LEVELS = Array.from({ length: SPELL_LEVEL_MAX + 1 }, (_, i) => i);

interface SpellsTabProps {
  spells: CharacterSpell[];
  spellSlots: CharacterSpellSlot[];
  canEdit: boolean;
  onUpdateSpells: (spells: CharacterSpell[]) => void;
  onUpdateSlots: (slots: CharacterSpellSlot[]) => void;
}

export function SpellsTab({
  spells,
  spellSlots,
  canEdit,
  onUpdateSpells,
  onUpdateSlots,
}: SpellsTabProps): ReactElement {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newLevel, setNewLevel] = useState(0);

  function getSlot(level: number): CharacterSpellSlot {
    return spellSlots.find((s) => s.level === level) ?? { level, max: 0, used: 0 };
  }

  /** Replace one level's slot entry; entries with max 0 are dropped */
  function setSlot(next: CharacterSpellSlot): void {
    const rest = spellSlots.filter((s) => s.level !== next.level);
    const merged = next.max > 0 ? [...rest, next] : rest;
    onUpdateSlots(merged.sort((a, b) => a.level - b.level));
  }

  function handlePipClick(level: number, pipIndex: number): void {
    const slot = getSlot(level);
    const used = pipIndex < slot.used ? pipIndex : pipIndex + 1;
    setSlot({ ...slot, used });
  }

  function handleMaxChange(level: number, delta: number): void {
    const slot = getSlot(level);
    const max = Math.max(0, Math.min(slot.max + delta, SPELL_SLOT_MAX_PER_LEVEL));
    setSlot({ level, max, used: Math.min(slot.used, max) });
  }

  function handleLongRest(): void {
    onUpdateSlots(spellSlots.map((s) => ({ ...s, used: 0 })));
  }

  function handleTogglePrepared(spellId: string): void {
    onUpdateSpells(
      spells.map((s) => (s.id === spellId ? { ...s, prepared: !s.prepared } : s)),
    );
  }

  function handleAddSpell(): void {
    const name = newName.trim();
    if (!name || spells.length >= CHARACTER_MAX_SPELLS) return;
    onUpdateSpells([
      ...spells,
      { id: crypto.randomUUID(), name, level: newLevel, prepared: false },
    ]);
    setNewName('');
  }

  function handleRemoveSpell(spellId: string): void {
    onUpdateSpells(spells.filter((s) => s.id !== spellId));
  }

  /**
   * Reorder within a level group. Removing the dragged spell first makes
   * `targetIndex` land before the target when dragging up and after it when
   * dragging down, so every position — including the end — is reachable.
   */
  function handleDrop(targetId: string): void {
    const sourceId = draggedId;
    setDraggedId(null);
    if (!sourceId || sourceId === targetId) return;
    const draggedIndex = spells.findIndex((s) => s.id === sourceId);
    const targetIndex = spells.findIndex((s) => s.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    if (spells[draggedIndex].level !== spells[targetIndex].level) return;
    const next = spells.filter((s) => s.id !== sourceId);
    next.splice(targetIndex, 0, spells[draggedIndex]);
    onUpdateSpells(next);
  }

  const visibleSlotLevels = canEdit
    ? SLOT_LEVELS
    : SLOT_LEVELS.filter((level) => getSlot(level).max > 0);
  const hasAnySlots = spellSlots.some((s) => s.max > 0);
  const spellLevelsWithSpells = SPELL_LEVELS.filter((level) =>
    spells.some((s) => s.level === level),
  );

  return (
    <div className={styles.container}>
      {/* Spell slots */}
      <section aria-label="Spell slots">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Spell Slots</h2>
          {canEdit && hasAnySlots && (
            <button type="button" className={styles.longRestButton} onClick={handleLongRest}>
              Long Rest
            </button>
          )}
        </div>
        {visibleSlotLevels.length === 0 && (
          <p className={styles.emptyText}>No spell slots.</p>
        )}
        {visibleSlotLevels.map((level) => {
          const slot = getSlot(level);
          return (
            <div key={level} className={styles.slotRow}>
              <span className={styles.slotLabel}>{SPELL_LEVEL_LABELS[level]}</span>
              <div className={styles.slotPips}>
                {Array.from({ length: slot.max }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`${styles.slotPip} ${i < slot.used ? styles.slotPipUsed : ''}`}
                    aria-label={`Level ${level} slot ${i + 1} (${i < slot.used ? 'used' : 'available'})`}
                    aria-pressed={i < slot.used}
                    disabled={!canEdit}
                    onClick={() => handlePipClick(level, i)}
                  />
                ))}
              </div>
              {canEdit && (
                <div className={styles.slotMaxControls}>
                  <button
                    type="button"
                    className={styles.slotMaxButton}
                    aria-label={`Remove a level ${level} slot`}
                    disabled={slot.max === 0}
                    onClick={() => handleMaxChange(level, -1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={styles.slotMaxButton}
                    aria-label={`Add a level ${level} slot`}
                    disabled={slot.max >= SPELL_SLOT_MAX_PER_LEVEL}
                    onClick={() => handleMaxChange(level, 1)}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Spell list */}
      <section aria-label="Spells">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Spells</h2>
        </div>
        {spells.length === 0 && <p className={styles.emptyText}>No spells known.</p>}
        {spellLevelsWithSpells.map((level) => (
          <div key={level} className={styles.spellGroup}>
            <h3 className={styles.spellGroupTitle}>{SPELL_LEVEL_LABELS[level]}</h3>
            <ul className={styles.spellList}>
              {spells
                .filter((s) => s.level === level)
                .map((spell) => (
                  <li
                    key={spell.id}
                    className={`${styles.spellRow} ${draggedId === spell.id ? styles.spellRowDragging : ''}`}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      // Firefox requires dataTransfer content to start a drag (null in jsdom)
                      e.dataTransfer?.setData('text/plain', spell.id);
                      setDraggedId(spell.id);
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(spell.id)}
                  >
                    {canEdit && (
                      <span className={styles.dragHandle} aria-hidden="true">
                        ⋮⋮
                      </span>
                    )}
                    <span className={styles.spellName}>{spell.name}</span>
                    <button
                      type="button"
                      className={`${styles.preparedToggle} ${spell.prepared ? styles.preparedToggleActive : ''}`}
                      aria-pressed={spell.prepared}
                      aria-label={`${spell.prepared ? 'Unprepare' : 'Prepare'} ${spell.name}`}
                      disabled={!canEdit}
                      onClick={() => handleTogglePrepared(spell.id)}
                    >
                      {spell.prepared ? 'Prepared' : 'Prepare'}
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        className={styles.removeButton}
                        aria-label={`Remove ${spell.name}`}
                        onClick={() => handleRemoveSpell(spell.id)}
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
        {canEdit && (
          <form
            className={styles.addForm}
            onSubmit={(e) => {
              e.preventDefault();
              handleAddSpell();
            }}
          >
            <input
              type="text"
              className={styles.addInput}
              placeholder="Spell name"
              aria-label="Spell name"
              value={newName}
              maxLength={SPELL_NAME_MAX_LENGTH}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select
              className={styles.addSelect}
              aria-label="Spell level"
              value={newLevel}
              onChange={(e) => setNewLevel(Number(e.target.value))}
            >
              {SPELL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {SPELL_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
            <button type="submit" className={styles.addButton} disabled={!newName.trim()}>
              Add Spell
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
