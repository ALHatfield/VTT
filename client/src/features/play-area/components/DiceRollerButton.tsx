import type { ReactElement } from 'react';
import { useRef, useState } from 'react';

import type { DiceAnimationMode } from '@vtt/shared';

import styles from './DiceRollerButton.module.css';

const QUICK_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;

interface DiceRollerButtonProps {
  onRoll: (formula: string) => void;
  /** True while the user's own roll is in flight — one roll at a time. */
  rollDisabled?: boolean;
  animationMode: DiceAnimationMode;
  onAnimationModeChange: (mode: DiceAnimationMode) => void;
  /** Dev-only orbit/zoom camera toggle — rendered only when provided. */
  cameraControlsEnabled?: boolean;
  onCameraControlsChange?: (enabled: boolean) => void;
}

/** Quick-pick dice menu — emits a roll formula directly to the server. */
export function DiceRollerButton({
  onRoll,
  rollDisabled = false,
  animationMode,
  onAnimationModeChange,
  cameraControlsEnabled,
  onCameraControlsChange,
}: DiceRollerButtonProps): ReactElement {
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
                disabled={rollDisabled}
                title={rollDisabled ? 'Waiting for your current roll to finish' : undefined}
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
            <button
              type="submit"
              className={styles.rollBtn}
              disabled={rollDisabled || !custom.trim()}
              title={rollDisabled ? 'Waiting for your current roll to finish' : undefined}
            >
              Roll
            </button>
          </form>
          <div className={styles.settings}>
            <label className={styles.settingRow}>
              <input
                type="checkbox"
                checked={animationMode === '3d'}
                onChange={(e) => {
                  onAnimationModeChange(e.target.checked ? '3d' : 'instant');
                }}
              />
              3D dice
            </label>
            {onCameraControlsChange && (
              <label className={styles.settingRow} title="Dev only — overlay captures the pointer while enabled">
                <input
                  type="checkbox"
                  checked={cameraControlsEnabled ?? false}
                  onChange={(e) => {
                    onCameraControlsChange(e.target.checked);
                  }}
                />
                Camera controls (dev)
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

