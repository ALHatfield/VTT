import type { Character } from '@vtt/shared';
import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { calculateModifier } from '@vtt/shared';

import styles from './CharacterList.module.css';
import { useCharacters } from './hooks/useCharacters';

function hpColor(hp: number, maxHp: number): string {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  if (ratio > 0.5) return '#51cf66';
  if (ratio > 0.25) return '#ffd43b';
  if (ratio > 0) return '#ff6b6b';
  return '#868e96';
}

interface CharacterCardProps {
  character: Character;
  onClick: () => void;
}

function CharacterCard({ character, onClick }: CharacterCardProps): ReactElement {
  const dexMod = calculateModifier(character.abilityScores.dexterity);

  return (
    <div className={styles.card} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}>
      <div className={styles.cardName}>{character.name}</div>
      <div className={styles.cardMeta}>
        Level {character.level} {character.race} {character.class}
      </div>
      <div className={styles.cardStats}>
        <span className={styles.statBadge}>
          <span className={styles.statLabel}>HP</span>
          <span style={{ color: hpColor(character.hp, character.maxHp) }}>
            {character.hp}/{character.maxHp}
          </span>
        </span>
        <span className={styles.statBadge}>
          <span className={styles.statLabel}>AC</span> {character.ac}
        </span>
        <span className={styles.statBadge}>
          <span className={styles.statLabel}>DEX</span>{' '}
          {dexMod >= 0 ? `+${dexMod}` : dexMod}
        </span>
      </div>
    </div>
  );
}

export function CharacterList(): ReactElement {
  const { id: campaignId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { characters, isLoading, error } = useCharacters(campaignId!);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.statusText}>Loading characters…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Characters</h1>
        <button
          type="button"
          className={styles.createButton}
          onClick={() => navigate(`/campaigns/${campaignId}/characters/new`)}
        >
          + New Character
        </button>
      </div>

      {characters.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No characters yet. Create one to get started!</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {characters.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              onClick={() => navigate(`/campaigns/${campaignId}/characters/${c.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
