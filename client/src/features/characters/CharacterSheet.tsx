import type { ReactElement } from 'react';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { CharacterAttack, CharacterSheetTab, CharacterSpell, CharacterSpellSlot, SkillName } from '@vtt/shared';
import { CHARACTER_SHEET_TABS } from '@vtt/shared';

import { useCampaign } from '../../shared/context/CampaignContext';
import { useAuth } from '../auth/AuthContext';
import styles from './CharacterSheet.module.css';
import { SpellsTab } from './components/SpellsTab';
import { StatsTab } from './components/StatsTab';
import { useCharacterActions } from './hooks/useCharacterActions';
import { useCharacterDetail } from './hooks/useCharacterDetail';
import { useCharacterSocket } from './hooks/useCharacterSocket';
import { formatModifier } from './utils';

export function CharacterSheet(): ReactElement {
  const { id: campaignId, charId } = useParams<{ id: string; charId: string }>();
  const navigate = useNavigate();
  const { character, isLoading, error, refresh } = useCharacterDetail(campaignId!, charId!);
  const { updateHp, updateCharacter } = useCharacterActions();
  const { user } = useAuth();
  const { campaign } = useCampaign();

  const [activeTab, setActiveTab] = useState<CharacterSheetTab>('stats');
  const [hpValue, setHpValue] = useState<string | null>(null);
  // Optimistic copies so rapid skill/attack/spell edits never compute from stale data
  const [localSkills, setLocalSkills] = useState<SkillName[] | null>(null);
  const [localAttacks, setLocalAttacks] = useState<CharacterAttack[] | null>(null);
  const [localSpells, setLocalSpells] = useState<CharacterSpell[] | null>(null);
  const [localSlots, setLocalSlots] = useState<CharacterSpellSlot[] | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Edits currently queued or in flight — own broadcast echoes are ignored while > 0 */
  const pendingSavesRef = useRef(0);
  /** Serializes PUTs so rapid edits cannot apply out of order server-side */
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Live sync: token HP edits and remote sheet edits update this sheet in real time
  const { emitDiceRoll, isConnected, lastError } = useCharacterSocket({
    campaignId,
    onHpUpdated: (payload) => {
      if (payload.characterId === charId) refresh();
    },
    onSheetUpdated: (payload) => {
      if (payload.characterId !== charId) return;
      // Echoes of our own in-flight edits would clobber newer optimistic state
      if (pendingSavesRef.current > 0) return;
      // Server state is now the truth — drop optimistic overrides
      setLocalSkills(null);
      setLocalAttacks(null);
      setLocalSpells(null);
      setLocalSlots(null);
      refresh();
    },
  });

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
          onClick={() => navigate(`/campaigns/${campaignId}`)}
        >
          ← Back to Campaign
        </button>
      </div>
    );
  }

  // Rolls use the stored (editable) proficiency bonus — the source of truth
  const profBonus = character.proficiencyBonus;
  const role = campaign?.role;
  // Global templates (campaignId null) are read-only — the server rejects edits
  const canEdit =
    (role === 'dm' || character.userId === user?.id) && character.campaignId !== null;
  const canRoll = isConnected && role !== 'observer';
  const skillProficiencies = localSkills ?? character.skillProficiencies;
  const attacks = localAttacks ?? character.attacks;
  const spells = localSpells ?? character.spells;
  const spellSlots = localSlots ?? character.spellSlots;

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

  /**
   * Queue a sheet edit: saves run strictly in order, failures roll back the
   * optimistic state and surface in the error banner, and the sheet refetches
   * once the queue drains.
   */
  function queueSave(save: () => Promise<unknown>, rollback: () => void, what: string): void {
    pendingSavesRef.current += 1;
    saveQueueRef.current = saveQueueRef.current
      .then(save)
      .then(() => setSaveError(null))
      .catch((err) => {
        rollback();
        setSaveError(`Failed to save ${what}`);
        console.error(`Failed to save ${what}:`, err);
      })
      .finally(() => {
        pendingSavesRef.current -= 1;
        if (pendingSavesRef.current === 0) refresh();
      });
  }

  function handleToggleSkill(skill: SkillName): void {
    const next = skillProficiencies.includes(skill)
      ? skillProficiencies.filter((s) => s !== skill)
      : [...skillProficiencies, skill];
    setLocalSkills(next);
    queueSave(
      () => updateCharacter(campaignId!, charId!, { skillProficiencies: next }),
      () => setLocalSkills(null),
      'skill proficiencies',
    );
  }

  function handleAddAttack(attack: CharacterAttack): void {
    const next = [...attacks, attack];
    setLocalAttacks(next);
    queueSave(
      () => updateCharacter(campaignId!, charId!, { attacks: next }),
      () => setLocalAttacks(null),
      'attacks',
    );
  }

  function handleRemoveAttack(attackId: string): void {
    const next = attacks.filter((a) => a.id !== attackId);
    setLocalAttacks(next);
    queueSave(
      () => updateCharacter(campaignId!, charId!, { attacks: next }),
      () => setLocalAttacks(null),
      'attacks',
    );
  }

  function handleUpdateSpells(next: CharacterSpell[]): void {
    setLocalSpells(next);
    queueSave(
      () => updateCharacter(campaignId!, charId!, { spells: next }),
      () => setLocalSpells(null),
      'spells',
    );
  }

  function handleUpdateSlots(next: CharacterSpellSlot[]): void {
    setLocalSlots(next);
    queueSave(
      () => updateCharacter(campaignId!, charId!, { spellSlots: next }),
      () => setLocalSlots(null),
      'spell slots',
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(`/campaigns/${campaignId}`)}
        >
          ← Campaign
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
      {(lastError ?? saveError) && (
        <p className={styles.errorText} role="alert">
          {saveError ?? lastError}
        </p>
      )}
      {activeTab === 'stats' && (
        <StatsTab
          abilityScores={character.abilityScores}
          proficiencyBonus={profBonus}
          skillProficiencies={skillProficiencies}
          attacks={attacks}
          canRoll={canRoll}
          canEdit={canEdit}
          onRoll={emitDiceRoll}
          onToggleSkill={handleToggleSkill}
          onAddAttack={handleAddAttack}
          onRemoveAttack={handleRemoveAttack}
        />
      )}
      {activeTab === 'biography' && <BiographyTab biography={character.biography} />}
      {activeTab === 'inventory' && (
        <div className={styles.placeholderContent}>
          {/* Embed-only: InventoryPanel arrives with inventory Phase 10B */}
          <p>Inventory coming soon — provided by the inventory feature (Phase 10B)</p>
        </div>
      )}
      {activeTab === 'spells' && (
        <SpellsTab
          spells={spells}
          spellSlots={spellSlots}
          canEdit={canEdit}
          onUpdateSpells={handleUpdateSpells}
          onUpdateSlots={handleUpdateSlots}
        />
      )}
    </div>
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
