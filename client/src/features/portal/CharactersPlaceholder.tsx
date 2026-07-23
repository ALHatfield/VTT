import type { ReactElement } from 'react';

import styles from './Placeholder.module.css';

const PLACEHOLDER_CHARACTERS = [
  { name: 'Thorin Ironforge', description: 'Dwarf Fighter, Level 5', date: 'May 2026' },
  { name: 'Elara Moonwhisper', description: 'Elf Wizard, Level 3', date: 'May 2026' },
  { name: 'Grimshaw', description: 'Half-Orc Barbarian, Level 7', date: 'May 2026' },
] as const;

export function CharactersPlaceholder(): ReactElement {
  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Character Sheets</h2>
      <p className={styles.description}>
        Character management will be available in Phase 6A.
      </p>
      <div className={styles.cardGrid}>
        {PLACEHOLDER_CHARACTERS.map((character) => (
          <div key={character.name} className={styles.card}>
            <h3 className={styles.cardTitle}>{character.name}</h3>
            <p className={styles.cardText}>{character.description}</p>
            <div className={styles.cardFooter}>
              <span className={styles.cardDate}>{character.date}</span>
              <div className={styles.cardActions}>
                <button type="button" className={styles.cardButton} disabled>Settings</button>
                <button type="button" className={styles.cardButton} disabled>Sheet</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
