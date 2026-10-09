import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Character } from '@vtt/shared';
import { calculateModifier } from '@vtt/shared';

import styles from './CharacterCards.module.css';

function hpColor(hp: number, maxHp: number): string {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  if (ratio > 0.5) return '#51cf66';
  if (ratio > 0.25) return '#ffd43b';
  if (ratio > 0) return '#ff6b6b';
  return '#868e96';
}

interface CharacterCardsProps {
  campaignId: string;
  characters: Character[];
}

/**
 * Character cards grid with a create button — embedded in the campaign
 * settings page. Cards navigate to the character sheet.
 */
export function CharacterCards({ campaignId, characters }: CharacterCardsProps): ReactElement {
  const navigate = useNavigate();

  return (
    <div>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.createButton}
          onClick={() => navigate(`/campaigns/${campaignId}/characters/new`)}
        >
          + New Character
        </button>
      </div>

      {characters.length === 0 ? (
        <p className={styles.emptyState}>No characters yet. Create one to get started!</p>
      ) : (
        <div className={styles.grid}>
          {characters.map((character) => {
            const dexMod = calculateModifier(character.abilityScores.dexterity);
            return (
              <div
                key={character.id}
                className={styles.card}
                onClick={() => navigate(`/campaigns/${campaignId}/characters/${character.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/campaigns/${campaignId}/characters/${character.id}`);
                  }
                }}
              >
                <div className={styles.cardName}>
                  {character.name}
                  {character.campaignId === null && (
                    <span className={styles.templateBadge}>TEMPLATE</span>
                  )}
                </div>
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
          })}
        </div>
      )}
    </div>
  );
}
