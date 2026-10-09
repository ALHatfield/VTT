// SaveStatusIndicator — Phase 5H
import type { ReactElement } from 'react';

import type { SaveStatus } from '../utils/save-tracker';
import styles from './SaveStatusIndicator.module.css';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  onRetry: () => void;
}

export function SaveStatusIndicator({ status, onRetry }: SaveStatusIndicatorProps): ReactElement | null {
  if (status === 'idle') return null;

  if (status === 'error') {
    return (
      <span className={`${styles.indicator} ${styles.error}`} role="status">
        Save failed
        <button type="button" className={styles.retryBtn} onClick={onRetry}>
          Retry
        </button>
      </span>
    );
  }

  return (
    <span
      className={`${styles.indicator} ${status === 'saving' ? styles.saving : styles.saved}`}
      role="status"
    >
      {status === 'saving' ? 'Saving…' : 'Saved'}
    </span>
  );
}
