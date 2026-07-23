import type { ReactElement } from 'react';

import styles from './Placeholder.module.css';

export function Account(): ReactElement {
  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Account Settings</h2>
      <p className={styles.description}>
        Account management is coming soon.
      </p>
    </div>
  );
}
