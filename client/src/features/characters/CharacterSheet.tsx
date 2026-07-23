import type { AbilityScores, CharacterSheetTab } from '@vtt/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
    ABILITY_NAMES,
    calculateModifier,
    calculateProficiencyBonus,
    calculateSpellSaveDC,
    CHARACTER_SHEET_TABS,
} from '@vtt/shared';

import styles from './CharacterSheet.module.css';
import { useCharacterActions } from './hooks/useCharacterActions';
import { useCharacterDetail } from './hooks/useCharacterDetail';
import { abilityAbbreviation } from './utils';

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function CharacterSheet(): ReactElement {
  const { id: campaignId, charId } = useParams<{ id: string; charId: string }>();
  const navigate = useNavigate();
  const { character, isLoading, error, refresh } = useCharacterDetail(campaignId!, charId!);
  const { updateHp } = useCharacterActions();

  const [activeTab, setActiveTab] = useState<CharacterSheetTab>('stats');
  const [hpValue, setHpValue] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.statusText}>Loading character…</p>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{error ?? 'Character not found'}</p>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(`/campaigns/${campaignId}/characters`)}
        >
          ← Back to Characters
        </button>
      </div>
    );
  }

  const profBonus = calculateProficiencyBonus(character.level);

  async function handleHpBlur(): Promise<void> {
    if (hpValue === null) return;
    const parsed = parseInt(hpValue, 10);
    if (isNaN(parsed) || parsed === character!.hp) {
      setHpValue(null);
      return;
    }
    const clamped = Math.max(0, Math.min(parsed, character!.maxHp));
    try {
      await updateHp(campaignId!, charId!, clamped);
      refresh();
    } catch (err) {
      console.error('Failed to update HP:', err);
    }
    setHpValue(null);
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(`/campaigns/${campaignId}/characters`)}
        >
          ← Characters
        </button>
      </div>

      {/* Identity */}
      <div className={styles.identity}>
        <h1 className={styles.charName}>{character.name}</h1>
        <p className={styles.charMeta}>
          Level {character.level} {character.race} {character.class}
        </p>
      </div>

      {/* Core Stats */}
      <div className={styles.coreStats}>
        <div className={styles.coreStat}>
          <div className={styles.coreStatLabel}>HP</div>
          <div className={styles.hpBar}>
            <input
              type="number"
              className={styles.hpInput}
              value={hpValue ?? character.hp}
              min={0}
              max={character.maxHp}
              onChange={(e) => setHpValue(e.target.value)}
              onBlur={handleHpBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
            <span className={styles.hpSeparator}>/</span>
            <span className={styles.coreStatValue}>{character.maxHp}</span>
          </div>
        </div>
        <div className={styles.coreStat}>
          <div className={styles.coreStatLabel}>AC</div>
          <div className={styles.coreStatValue}>{character.ac}</div>
        </div>
        <div className={styles.coreStat}>
          <div className={styles.coreStatLabel}>Speed</div>
          <div className={styles.coreStatValue}>{character.speed} ft</div>
        </div>
        <div className={styles.coreStat}>
          <div className={styles.coreStatLabel}>Prof. Bonus</div>
          <div className={styles.coreStatValue}>{formatModifier(profBonus)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {CHARACTER_SHEET_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'stats' && (
        <StatsTab abilityScores={character.abilityScores} proficiencyBonus={profBonus} />
      )}
      {activeTab === 'biography' && <BiographyTab biography={character.biography} />}
      {activeTab === 'inventory' && (
        <div className={styles.placeholderContent}>
          <p>Inventory management coming in Phase 6D</p>
        </div>
      )}
      {activeTab === 'spells' && (
        <div className={styles.placeholderContent}>
          <p>Spell tracking coming in Phase 6D</p>
        </div>
      )}
    </div>
  );
}

interface StatsTabProps {
  abilityScores: AbilityScores;
  proficiencyBonus: number;
}

function StatsTab({ abilityScores, proficiencyBonus }: StatsTabProps): ReactElement {
  const intMod = calculateModifier(abilityScores.intelligence);
  const wisMod = calculateModifier(abilityScores.wisdom);
  const chaMod = calculateModifier(abilityScores.charisma);

  return (
    <>
      <div className={styles.abilityGrid}>
        {ABILITY_NAMES.map((name) => {
          const score = abilityScores[name];
          const mod = calculateModifier(score);
          return (
            <div key={name} className={styles.abilityCard}>
              <div className={styles.abilityName}>{abilityAbbreviation(name)}</div>
              <div className={styles.abilityModifier}>{formatModifier(mod)}</div>
              <div className={styles.abilityScore}>{score}</div>
            </div>
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
        <div className={styles.computedStat}>
          <span className={styles.computedStatLabel}>Initiative</span>
          <span className={styles.computedStatValue}>
            {formatModifier(calculateModifier(abilityScores.dexterity))}
          </span>
        </div>
      </div>
    </>
  );
}

interface BiographyTabProps {
  biography: string | null;
}

function BiographyTab({ biography }: BiographyTabProps): ReactElement {
  return (
    <div className={styles.biographyContent}>
      {biography || 'No biography written yet.'}
    </div>
  );
}
