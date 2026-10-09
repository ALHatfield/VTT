// LightInspector — Phase 5G
// Properties for the selected light: color, intensity, radius, falloff, animation mode.
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { LightAnimationMode, LightSource, LightSourceUpdatePayload } from '@vtt/shared';
import {
    LIGHT_ANIMATION_MODES,
    LIGHT_COORDINATE_LIMIT,
    LIGHT_PRESETS,
    LIGHT_RADIUS_MAX,
    LIGHT_RADIUS_MIN,
} from '@vtt/shared';

import styles from './LightInspector.module.css';

const UNIT_STEP = 0.05;
const RADIUS_STEP = 0.5;
const PERCENT = 100;

const ANIMATION_LABEL: Record<LightAnimationMode, string> = {
  none: 'Steady',
  flicker: 'Flicker',
  pulse: 'Pulse',
};

interface CoordinateInputProps {
  label: 'X' | 'Y';
  value: number;
  onCommit: (value: number) => void;
}

function CoordinateInput({ label, value, onCommit }: CoordinateInputProps): ReactElement {
  const [draft, setDraft] = useState(String(Math.round(value)));

  useEffect(() => {
    setDraft(String(Math.round(value)));
  }, [value]);

  const commit = (): void => {
    const next = Number(draft);
    const isValid =
      draft.trim() !== '' && Number.isFinite(next) && Math.abs(next) <= LIGHT_COORDINATE_LIMIT;
    if (isValid && next !== value) onCommit(next);
    else setDraft(String(Math.round(value)));
  };

  return (
    <label className={styles.coordinate}>
      <span className={styles.coordinateLabel}>{label}</span>
      <input
        type="number"
        aria-label={`Position ${label}`}
        className={styles.number}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </label>
  );
}

interface LightInspectorProps {
  light: LightSource | null;
  onUpdate: (lightId: string, payload: LightSourceUpdatePayload) => void;
  onDelete: (lightId: string) => void;
}

export function LightInspector({ light, onUpdate, onDelete }: LightInspectorProps): ReactElement {
  if (!light) {
    return (
      <div className={styles.inspector}>
        <p className={styles.empty}>Select a light to edit its properties.</p>
      </div>
    );
  }

  return (
    <section className={styles.inspector} aria-label="Light inspector">
      <h3 className={styles.heading}>{LIGHT_PRESETS[light.emitterType].label}</h3>
      <div className={styles.position}>
        <CoordinateInput label="X" value={light.x} onCommit={(x) => onUpdate(light.id, { x })} />
        <CoordinateInput label="Y" value={light.y} onCommit={(y) => onUpdate(light.id, { y })} />
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Color</span>
        <input
          type="color"
          className={styles.color}
          value={light.color}
          onChange={(e) => onUpdate(light.id, { color: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Intensity</span>
        <input
          type="range"
          aria-label="Intensity"
          className={styles.slider}
          min={0}
          max={1}
          step={UNIT_STEP}
          value={light.intensity}
          onChange={(e) => onUpdate(light.id, { intensity: Number(e.target.value) })}
        />
        <span className={styles.value}>{Math.round(light.intensity * PERCENT)}%</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Radius</span>
        <input
          type="range"
          aria-label="Radius"
          className={styles.slider}
          min={LIGHT_RADIUS_MIN}
          max={LIGHT_RADIUS_MAX}
          step={RADIUS_STEP}
          value={light.radius}
          onChange={(e) => onUpdate(light.id, { radius: Number(e.target.value) })}
        />
        <span className={styles.value}>{light.radius} cells</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Falloff</span>
        <input
          type="range"
          aria-label="Falloff"
          className={styles.slider}
          min={0}
          max={1}
          step={UNIT_STEP}
          value={light.falloff}
          onChange={(e) => onUpdate(light.id, { falloff: Number(e.target.value) })}
        />
        <span className={styles.value}>{Math.round(light.falloff * PERCENT)}%</span>
      </label>

      <label
        className={styles.field}
        title="Players see this light even when no party token has line of sight to it"
      >
        <span className={styles.label}>Always on</span>
        <input
          type="checkbox"
          aria-label="Always on"
          className={styles.checkbox}
          checked={light.alwaysVisible}
          onChange={(e) => onUpdate(light.id, { alwaysVisible: e.target.checked })}
        />
      </label>

      <div className={styles.animation} role="group" aria-label="Animation mode">
        {LIGHT_ANIMATION_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={light.animationMode === mode}
            className={`${styles.modeBtn} ${light.animationMode === mode ? styles.modeBtnActive : ''}`}
            onClick={() => onUpdate(light.id, { animationMode: mode })}
          >
            {ANIMATION_LABEL[mode]}
          </button>
        ))}
      </div>

      <button type="button" className={styles.deleteBtn} onClick={() => onDelete(light.id)}>
        Delete light
      </button>
    </section>
  );
}
