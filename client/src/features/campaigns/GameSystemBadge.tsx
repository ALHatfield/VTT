import type { GameSystem } from '@vtt/shared';
import { GAME_SYSTEM_LABELS } from '@vtt/shared';
import type { ReactElement } from 'react';

import styles from './GameSystemBadge.module.css';

interface GameSystemBadgeProps {
  system: GameSystem;
}

export function GameSystemBadge({ system }: GameSystemBadgeProps): ReactElement {
  return (
    <span className={`${styles.badge} ${styles[system]}`} data-testid="game-system-badge">
      {GAME_SYSTEM_LABELS[system]}
    </span>
  );
}
