import type { ReactElement } from 'react';

import styles from './Placeholder.module.css';

const PLACEHOLDER_CAMPAIGNS = [
  { title: 'Dragon\'s Lair', description: 'A perilous dungeon awaits...', date: 'May 2026' },
  { title: 'Lost Mines', description: 'Explore the ruins of Phandelver...', date: 'May 2026' },
  { title: 'Curse of Strahd', description: 'Darkness looms over Barovia...', date: 'May 2026' },
] as const;

export function CampaignsPlaceholder(): ReactElement {
  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Campaigns</h2>
      <p className={styles.description}>
        Campaign management will be available in Phase 3A.
      </p>
      <div className={styles.cardGrid}>
        {PLACEHOLDER_CAMPAIGNS.map((campaign) => (
          <div key={campaign.title} className={styles.card}>
            <h3 className={styles.cardTitle}>{campaign.title}</h3>
            <p className={styles.cardText}>{campaign.description}</p>
            <div className={styles.cardFooter}>
              <span className={styles.cardDate}>{campaign.date}</span>
              <div className={styles.cardActions}>
                <button type="button" className={styles.cardButton} disabled>Settings</button>
                <button type="button" className={styles.cardButton} disabled>Play</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
