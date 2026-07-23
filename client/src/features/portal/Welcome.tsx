import type { ReactElement } from 'react';

import styles from './Welcome.module.css';

const NEWS_ITEMS = [
  {
    title: 'Welcome to VTT',
    text: 'Your virtual tabletop for playing TTRPGs online. Explore campaigns, manage characters, and roll dice with your party.',
  },
  {
    title: 'Getting Started',
    text: 'Create or join a campaign to begin. Your DM will set up maps and tokens — then jump into the play area for your session.',
  },
  {
    title: 'Coming Soon',
    text: 'Character sheets, integrated dice rolling, fog of war, and real-time combat tracking are on the way.',
  },
] as const;

const ACTIVITY_ITEMS = [
  'No recent activity yet. Join a campaign to get started!',
] as const;

export function Welcome(): ReactElement {
  return (
    <div className={styles.page}>
      <section>
        <h2 className={styles.sectionTitle}>News</h2>
        <div className={styles.cardGrid}>
          {NEWS_ITEMS.map((item) => (
            <div key={item.title} className={styles.card}>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardText}>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Recent Activity</h2>
        <div className={styles.activityList}>
          {ACTIVITY_ITEMS.map((item) => (
            <div key={item} className={styles.activityItem}>
              <div className={styles.activityDot} />
              <span className={styles.activityText}>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
