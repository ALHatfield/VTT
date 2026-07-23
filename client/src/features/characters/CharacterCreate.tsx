import type { AbilityScores, CharacterCreatePayload } from '@vtt/shared';
import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ABILITY_NAMES, DEFAULT_ABILITY_SCORES } from '@vtt/shared';

import styles from './CharacterCreate.module.css';
import { useCharacterActions } from './hooks/useCharacterActions';
import { abilityAbbreviation } from './utils';

export function CharacterCreate(): ReactElement {
  const { id: campaignId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { createCharacter } = useCharacterActions();

  const [name, setName] = useState('');
  const [race, setRace] = useState('');
  const [charClass, setCharClass] = useState('');
  const [level, setLevel] = useState(1);
  const [hp, setHp] = useState(10);
  const [maxHp, setMaxHp] = useState(10);
  const [ac, setAc] = useState(10);
  const [speed, setSpeed] = useState(30);
  const [abilityScores, setAbilityScores] = useState<AbilityScores>({ ...DEFAULT_ABILITY_SCORES });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAbilityChange(ability: keyof AbilityScores, value: string): void {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return;
    setAbilityScores((prev) => ({ ...prev, [ability]: Math.max(1, Math.min(30, parsed)) }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload: CharacterCreatePayload = {
      name: name.trim(),
      race: race.trim(),
      class: charClass.trim(),
      level,
      hp,
      maxHp,
      ac,
      speed,
      abilityScores,
    };

    try {
      const created = await createCharacter(campaignId!, payload);
      navigate(`/campaigns/${campaignId}/characters/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create character');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Create Character</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="char-name">Name</label>
          <input
            id="char-name"
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="char-race">Race</label>
            <input
              id="char-race"
              className={styles.input}
              type="text"
              value={race}
              onChange={(e) => setRace(e.target.value)}
              required
              maxLength={50}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="char-class">Class</label>
            <input
              id="char-class"
              className={styles.input}
              type="text"
              value={charClass}
              onChange={(e) => setCharClass(e.target.value)}
              required
              maxLength={50}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="char-level">Level</label>
            <input
              id="char-level"
              className={styles.input}
              type="number"
              value={level}
              min={1}
              max={20}
              onChange={(e) => setLevel(parseInt(e.target.value, 10) || 1)}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="char-hp">HP</label>
            <input
              id="char-hp"
              className={styles.input}
              type="number"
              value={hp}
              min={0}
              max={999}
              onChange={(e) => setHp(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="char-maxhp">Max HP</label>
            <input
              id="char-maxhp"
              className={styles.input}
              type="number"
              value={maxHp}
              min={1}
              max={999}
              onChange={(e) => setMaxHp(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="char-ac">AC</label>
            <input
              id="char-ac"
              className={styles.input}
              type="number"
              value={ac}
              min={0}
              max={30}
              onChange={(e) => setAc(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="char-speed">Speed</label>
            <input
              id="char-speed"
              className={styles.input}
              type="number"
              value={speed}
              min={0}
              max={120}
              onChange={(e) => setSpeed(parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>

        <label className={styles.label}>Ability Scores</label>
        <div className={styles.abilityRow}>
          {ABILITY_NAMES.map((ability) => (
            <div key={ability} className={styles.abilityField}>
              <span className={styles.abilityLabel}>{abilityAbbreviation(ability)}</span>
              <input
                className={styles.abilityInput}
                type="number"
                value={abilityScores[ability]}
                min={1}
                max={30}
                onChange={(e) => handleAbilityChange(ability, e.target.value)}
              />
            </div>
          ))}
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating…' : 'Create Character'}
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => navigate(`/campaigns/${campaignId}/characters`)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
