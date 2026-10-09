import type { ReactElement } from 'react';
import { useState } from 'react';

import type {
    AbilityName,
    AbilityScores,
    CharacterAttack,
    RollAdvantageMode,
    SkillName,
} from '@vtt/shared';
import {
    ABILITY_NAMES,
    buildD20RollFormula,
    buildDamageRollFormula,
    calculateModifier,
    calculateSpellSaveDC,
    DAMAGE_DICE_PATTERN,
    ROLL_ADVANTAGE_MODES,
    SKILL_DEFINITIONS,
} from '@vtt/shared';

import { abilityAbbreviation, formatModifier } from '../utils';
import styles from './StatsTab.module.css';

const ADVANTAGE_MODE_LABELS: Record<RollAdvantageMode, string> = {
  normal: 'Normal',
  advantage: 'Advantage',
  disadvantage: 'Disadvantage',
};

interface StatsTabProps {
  abilityScores: AbilityScores;
  proficiencyBonus: number;
  skillProficiencies: SkillName[];
  attacks: CharacterAttack[];
  /** Rolls are disabled while the campaign socket is disconnected */
  canRoll: boolean;
  /** Owner or DM — gates skill/attack editing controls */
  canEdit: boolean;
  onRoll: (formula: string, label: string) => void;
  onToggleSkill: (skill: SkillName) => void;
  onAddAttack: (attack: CharacterAttack) => void;
  onRemoveAttack: (attackId: string) => void;
}

export function StatsTab({
  abilityScores,
  proficiencyBonus,
  skillProficiencies,
  attacks,
  canRoll,
  canEdit,
  onRoll,
  onToggleSkill,
  onAddAttack,
  onRemoveAttack,
}: StatsTabProps): ReactElement {
  const [advantageMode, setAdvantageMode] = useState<RollAdvantageMode>('normal');
  const [isEditingSkills, setIsEditingSkills] = useState(false);

  const intMod = calculateModifier(abilityScores.intelligence);
  const wisMod = calculateModifier(abilityScores.wisdom);
  const chaMod = calculateModifier(abilityScores.charisma);
  const dexMod = calculateModifier(abilityScores.dexterity);

  function rollD20(modifier: number, label: string): void {
    onRoll(buildD20RollFormula(modifier, advantageMode), label);
  }

  function skillModifier(skill: SkillName, ability: AbilityName): number {
    const base = calculateModifier(abilityScores[ability]);
    return skillProficiencies.includes(skill) ? base + proficiencyBonus : base;
  }

  function attackModifier(attack: CharacterAttack): number {
    const base = calculateModifier(abilityScores[attack.ability]);
    return attack.proficient ? base + proficiencyBonus : base;
  }

  return (
    <>
      {/* Advantage / disadvantage toggle for all d20 rolls */}
      <div className={styles.advantageToggle} role="radiogroup" aria-label="Roll mode">
        {ROLL_ADVANTAGE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={advantageMode === mode}
            className={`${styles.advantageOption} ${advantageMode === mode ? styles.advantageOptionActive : ''}`}
            onClick={() => setAdvantageMode(mode)}
          >
            {ADVANTAGE_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* Ability scores — click to roll a check */}
      <div className={styles.abilityGrid}>
        {ABILITY_NAMES.map((name) => {
          const score = abilityScores[name];
          const mod = calculateModifier(score);
          const abbrev = abilityAbbreviation(name);
          return (
            <button
              key={name}
              type="button"
              className={styles.abilityCard}
              disabled={!canRoll}
              title={`Roll ${abbrev} check`}
              onClick={() => rollD20(mod, abbrev)}
            >
              <div className={styles.abilityName}>{abbrev}</div>
              <div className={styles.abilityModifier}>{formatModifier(mod)}</div>
              <div className={styles.abilityScore}>{score}</div>
            </button>
          );
        })}
      </div>

      <div className={styles.computedStats}>
        <div className={styles.computedStat}>
          <span className={styles.computedStatLabel}>Spell Save DC (INT)</span>
          <span className={styles.computedStatValue}>
            {calculateSpellSaveDC(proficiencyBonus, intMod)}
          </span>
        </div>
        <div className={styles.computedStat}>
          <span className={styles.computedStatLabel}>Spell Save DC (WIS)</span>
          <span className={styles.computedStatValue}>
            {calculateSpellSaveDC(proficiencyBonus, wisMod)}
          </span>
        </div>
        <div className={styles.computedStat}>
          <span className={styles.computedStatLabel}>Spell Save DC (CHA)</span>
          <span className={styles.computedStatValue}>
            {calculateSpellSaveDC(proficiencyBonus, chaMod)}
          </span>
        </div>
        <button
          type="button"
          className={`${styles.computedStat} ${styles.rollableStat}`}
          disabled={!canRoll}
          title="Roll initiative"
          onClick={() => rollD20(dexMod, 'Initiative')}
        >
          <span className={styles.computedStatLabel}>Initiative</span>
          <span className={styles.computedStatValue}>{formatModifier(dexMod)}</span>
        </button>
      </div>

      {/* Skills — click to roll; edit mode toggles proficiency */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Skills</h2>
        {canEdit && (
          <button
            type="button"
            className={styles.sectionAction}
            onClick={() => setIsEditingSkills((v) => !v)}
          >
            {isEditingSkills ? 'Done' : 'Edit proficiencies'}
          </button>
        )}
      </div>
      <div className={styles.skillGrid}>
        {SKILL_DEFINITIONS.map(({ name, label, ability }) => {
          const proficient = skillProficiencies.includes(name);
          const mod = skillModifier(name, ability);
          return (
            <button
              key={name}
              type="button"
              className={`${styles.skillRow} ${proficient ? styles.skillProficient : ''}`}
              disabled={!isEditingSkills && !canRoll}
              title={isEditingSkills ? `Toggle ${label} proficiency` : `Roll ${label}`}
              onClick={() => {
                if (isEditingSkills) {
                  onToggleSkill(name);
                } else {
                  rollD20(mod, label);
                }
              }}
            >
              <span className={styles.skillDot} aria-hidden="true">
                {proficient ? '●' : '○'}
              </span>
              <span className={styles.skillName}>{label}</span>
              <span className={styles.skillAbility}>{abilityAbbreviation(ability)}</span>
              <span className={styles.skillModifier}>{formatModifier(mod)}</span>
            </button>
          );
        })}
      </div>

      {/* Attacks — roll attack and damage */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Attacks</h2>
      </div>
      {attacks.length === 0 && (
        <p className={styles.emptyText}>No attacks yet — add one below.</p>
      )}
      {attacks.length > 0 && (
        <ul className={styles.attackList}>
          {attacks.map((attack) => {
            const atkMod = attackModifier(attack);
            const dmgMod = calculateModifier(abilityScores[attack.ability]);
            return (
              <li key={attack.id} className={styles.attackRow}>
                <span className={styles.attackName}>{attack.name}</span>
                <span className={styles.attackMeta}>
                  {abilityAbbreviation(attack.ability)}
                  {attack.proficient ? ' · prof' : ''}
                </span>
                <button
                  type="button"
                  className={styles.attackButton}
                  disabled={!canRoll}
                  title={`Roll attack: d20 ${formatModifier(atkMod)}`}
                  onClick={() => rollD20(atkMod, `${attack.name} attack`)}
                >
                  Attack {formatModifier(atkMod)}
                </button>
                <button
                  type="button"
                  className={styles.attackButton}
                  disabled={!canRoll}
                  title={`Roll damage: ${buildDamageRollFormula(attack.damageDice, dmgMod)}`}
                  onClick={() =>
                    onRoll(
                      buildDamageRollFormula(attack.damageDice, dmgMod),
                      `${attack.name} damage`,
                    )
                  }
                >
                  Damage {buildDamageRollFormula(attack.damageDice, dmgMod)}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className={styles.attackRemove}
                    title={`Remove ${attack.name}`}
                    onClick={() => onRemoveAttack(attack.id)}
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && <AttackForm onAdd={onAddAttack} />}
    </>
  );
}

interface AttackFormProps {
  onAdd: (attack: CharacterAttack) => void;
}

function AttackForm({ onAdd }: AttackFormProps): ReactElement {
  const [name, setName] = useState('');
  const [ability, setAbility] = useState<AbilityName>('strength');
  const [proficient, setProficient] = useState(true);
  const [damageDice, setDamageDice] = useState('1d8');
  const [formError, setFormError] = useState<string | null>(null);

  function handleAdd(): void {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Attack name is required');
      return;
    }
    if (!DAMAGE_DICE_PATTERN.test(damageDice.trim())) {
      setFormError('Damage dice must look like "1d8" or "2d6"');
      return;
    }
    setFormError(null);
    onAdd({
      id: crypto.randomUUID(),
      name: trimmedName,
      ability,
      proficient,
      damageDice: damageDice.trim(),
    });
    setName('');
  }

  return (
    <div className={styles.attackForm}>
      <input
        type="text"
        className={styles.attackInput}
        placeholder="Attack name"
        aria-label="Attack name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        className={styles.attackSelect}
        aria-label="Attack ability"
        value={ability}
        onChange={(e) => setAbility(e.target.value as AbilityName)}
      >
        {ABILITY_NAMES.map((n) => (
          <option key={n} value={n}>
            {abilityAbbreviation(n)}
          </option>
        ))}
      </select>
      <label className={styles.attackProficient}>
        <input
          type="checkbox"
          checked={proficient}
          onChange={(e) => setProficient(e.target.checked)}
        />
        Proficient
      </label>
      <input
        type="text"
        className={styles.attackInput}
        placeholder="1d8"
        aria-label="Damage dice"
        value={damageDice}
        onChange={(e) => setDamageDice(e.target.value)}
      />
      <button type="button" className={styles.attackAdd} onClick={handleAdd}>
        Add attack
      </button>
      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}
    </div>
  );
}
