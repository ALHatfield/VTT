import type { KeyboardEvent, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { ChatMessage, RollResult } from '@vtt/shared';
import { CHAT_MESSAGE_MAX_LENGTH } from '@vtt/shared';

import styles from './ChatPanel.module.css';

const ROLL_PREFIX = '/roll ';

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isConnected: boolean;
  onSend: (text: string) => void;
  onDiceRoll: (formula: string) => void;
}

/** Renders the structured breakdown for a roll-type chat message. */
function RollBreakdown({ rollData }: { rollData: RollResult }): ReactElement {
  const { rolls, keptRolls, modifier, total, advantage, disadvantage } = rollData;
  const hasAdvDis = advantage || disadvantage;

  return (
    <div className={styles.rollBreakdown}>
      <span className={styles.rollFormula}>rolled {rollData.formula}</span>
      <span className={styles.rollDice}>
        {hasAdvDis ? (
          // Show both rolled values; the dropped die is struck through.
          // keptIdx mirrors Math.max/Math.min tiebreaker (index 0 wins ties).
          (() => {
            const r0 = rolls[0] ?? 0;
            const r1 = rolls[1] ?? 0;
            const keptIdx = advantage ? (r0 >= r1 ? 0 : 1) : (r0 <= r1 ? 0 : 1);
            return rolls.map((v, i) => (
              <span
                key={i}
                className={i === keptIdx ? styles.rollDieKept : styles.rollDieDropped}
              >
                {v}
              </span>
            ));
          })()
        ) : (
          <span className={styles.rollDieKept}>{rolls.join(', ')}</span>
        )}
      </span>
      {modifier !== 0 && (
        <span className={styles.rollModifier}>
          {modifier > 0 ? `+${modifier.toString()}` : modifier.toString()}
        </span>
      )}
      <span className={styles.rollTotal}>{total}</span>
    </div>
  );
}

export function ChatPanel({
  messages,
  isLoading,
  isConnected,
  onSend,
  onDiceRoll,
}: ChatPanelProps): ReactElement {
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (): void => {
    const trimmed = text.trim();
    if (!trimmed || !isConnected) return;

    // Detect /roll command — route to dice roller instead of chat
    if (trimmed.toLowerCase().startsWith(ROLL_PREFIX)) {
      const formula = trimmed.slice(ROLL_PREFIX.length).trim();
      if (formula) {
        setSendError(null);
        onDiceRoll(formula);
        setText('');
      }
      return;
    }

    if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
      setSendError(`Message must be ${CHAT_MESSAGE_MAX_LENGTH.toString()} characters or fewer.`);
      return;
    }
    setSendError(null);
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Chat</span>
        <span className={`${styles.status} ${isConnected ? styles.statusConnected : styles.statusDisconnected}`}>
          <span className={styles.statusDot} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className={styles.messages} role="log" aria-live="polite">
        {isLoading && <p className={styles.empty}>Loading messages…</p>}
        {!isLoading && messages.length === 0 && (
          <p className={styles.empty}>No messages yet.</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${styles[`type_${msg.type}`]}`}
          >
            {msg.type === 'roll' ? (
              <>
                <span className={styles.msgUsername}>{msg.username}</span>
                {msg.rollData != null && (
                  <RollBreakdown rollData={msg.rollData as RollResult} />
                )}
              </>
            ) : msg.type === 'system' ? (
              <span className={styles.systemText}>{msg.text}</span>
            ) : (
              <>
                <span className={styles.msgUsername}>{msg.username}</span>
                <span className={styles.msgText}>{msg.text}</span>
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {sendError && (
        <div className={styles.errorBanner} role="alert">
          {sendError}
          <button
            className={styles.errorDismiss}
            onClick={() => setSendError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {!isConnected && (
        <div className={styles.disconnectedBanner} role="alert">
          Reconnecting…
        </div>
      )}

      <div className={styles.inputRow}>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? 'Chat or /roll d20… (Enter to send)' : 'Disconnected…'}
          disabled={!isConnected}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          rows={2}
          aria-label="Chat message input"
        />
      </div>
    </div>
  );
}

