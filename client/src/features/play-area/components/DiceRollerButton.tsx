import type { ReactElement } from 'react';
import { useRef, useState } from 'react';

import styles from './DiceRollerButton.module.css';

const QUICK_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;

interface DiceRollerButtonProps {
  onRoll: (formula: string) => void;
}

/** Quick-pick dice menu — emits a roll formula directly to the server. */
export function DiceRollerButton({ onRoll }: DiceRollerButtonProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDie(formula: string): void {
    onRoll(formula);
    setOpen(false);
  }

  function handleCustomSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const trimmed = custom.trim();
    if (trimmed) {
      onRoll(trimmed);
      setCustom('');
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        title="Open dice roller"
      >
        <span className={styles.icon}>🎲</span>
        <span>Dice Roller</span>
      </button>

      {open && (
        <div className={styles.menu}>
          <div className={styles.diceGrid}>
            {QUICK_DICE.map((d) => (
              <button
                key={d}
                type="button"
                className={styles.dieBtn}
                onClick={() => { handleDie(d); }}
              >
                {d}
              </button>
            ))}
          </div>
          <form className={styles.customRow} onSubmit={handleCustomSubmit}>
            <input
              ref={inputRef}
              className={styles.customInput}
              value={custom}
              onChange={(e) => { setCustom(e.target.value); }}
              placeholder="e.g. 3d6+4"
              aria-label="Custom dice formula"
            />
            <button type="submit" className={styles.rollBtn} disabled={!custom.trim()}>
              Roll
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

