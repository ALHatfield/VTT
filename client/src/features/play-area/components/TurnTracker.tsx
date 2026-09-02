import type { ReactElement } from 'react';

import type { CampaignRole, InitiativeState, InitiativeTurnEntry, Token } from '@vtt/shared';

import styles from './TurnTracker.module.css';

interface TurnTrackerProps {
  initiativeState: InitiativeState | null;
  tokens: Token[];
  selectedTokenIds: ReadonlySet<string>;
  role: CampaignRole | null;
  isConnected: boolean;
  onStart: (tokenIds?: string[]) => void;
  onAdvance: () => void;
  onEnd: () => void;
  onReorder: (tokenIds: string[]) => void;
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value.toString()}` : value.toString();
}

function moveEntry(order: InitiativeTurnEntry[], fromIndex: number, toIndex: number): string[] {
  const next = [...order];
  const [entry] = next.splice(fromIndex, 1);
  if (!entry) return order.map((item) => item.tokenId);
  next.splice(toIndex, 0, entry);
  return next.map((item) => item.tokenId);
}

export function TurnTracker({
  initiativeState,
  tokens,
  selectedTokenIds,
  role,
  isConnected,
  onStart,
  onAdvance,
  onEnd,
  onReorder,
}: TurnTrackerProps): ReactElement {
  const isDm = role === 'dm';
  const selectedIds = [...selectedTokenIds].filter((tokenId) =>
    tokens.some((token) => token.id === tokenId),
  );
  const startTokenIds = selectedIds.length > 0 ? selectedIds : tokens.map((token) => token.id);
  const canStart = isDm && isConnected && startTokenIds.length > 0;
  const order = initiativeState?.order ?? [];
  const canAdvance = isDm && isConnected && Boolean(initiativeState?.active) && order.length > 0;
  const canEnd = isDm && isConnected && Boolean(initiativeState?.active);

  return (
    <section className={styles.panel} aria-label="Turn tracker">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Initiative</span>
          <span className={styles.round}>Round {initiativeState?.round ?? 0}</span>
        </div>
        {isDm && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={!canStart}
              onClick={() => onStart(startTokenIds)}
            >
              {selectedIds.length > 0 ? 'Start Selected' : 'Start All'}
            </button>
            <button
              type="button"
              className={styles.advanceButton}
              disabled={!canAdvance}
              onClick={onAdvance}
            >
              Next Turn
            </button>
            <button type="button" className={styles.endButton} disabled={!canEnd} onClick={onEnd}>
              End Combat
            </button>
          </div>
        )}
      </div>

      {order.length === 0 ? (
        <p className={styles.empty}>No combatants in initiative.</p>
      ) : (
        <ol className={styles.turnList}>
          {order.map((entry, index) => {
            const active = entry.tokenId === initiativeState?.activeTokenId;
            return (
              <li key={entry.tokenId} className={active ? styles.activeTurn : styles.turnItem}>
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.combatant}>
                  <span className={styles.name}>{entry.tokenName}</span>
                  <span className={styles.meta}>
                    Init {formatModifier(entry.initiativeModifier)}
                  </span>
                </span>
                <span className={styles.total}>{entry.initiativeTotal ?? '-'}</span>
                {isDm && order.length > 1 && (
                  <span className={styles.reorderControls}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      disabled={!isConnected || index === 0}
                      onClick={() => onReorder(moveEntry(order, index, index - 1))}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      disabled={!isConnected || index === order.length - 1}
                      onClick={() => onReorder(moveEntry(order, index, index + 1))}
                    >
                      Down
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!isDm && <div className={styles.turnFooter}>Current turn updates automatically.</div>}
    </section>
  );
}
