// LightsSection — Phase 5G
// Lights tab of the LayersPanel: preset palette, visibility, list, atmosphere, inspector.
import type { DragEvent, ReactElement } from 'react';

import type {
    LightEmitterType,
    LightSource,
    LightSourceUpdatePayload,
    LightTone,
    WeatherPreset,
} from '@vtt/shared';
import { LIGHT_EMITTER_TYPES, LIGHT_PRESETS, WEATHER_PRESETS } from '@vtt/shared';

import { LIGHT_DRAG_MIME } from '../utils/light-placement';
import { LightInspector } from './LightInspector';
import styles from './LightsSection.module.css';

const TONE_CLASS: Record<LightTone, string> = {
  warm: styles.toneWarm,
  cold: styles.toneCold,
  neutral: styles.toneNeutral,
};

const WEATHER_LABEL: Record<WeatherPreset, string> = {
  none: 'None',
  rain: 'Rain',
  snow: 'Snow',
  haze: 'Haze',
};

export interface LightsSectionProps {
  lights: readonly LightSource[];
  selectedLightId: string | null;
  lightsVisible: boolean;
  error: string | null;
  /** Null while the scene atmosphere is loading. */
  weatherPreset: WeatherPreset | null;
  onToggleVisibility: () => void;
  /** Place a preset at the centre of the current view (keyboard/click alternative to dragging). */
  onAddPreset: (emitterType: LightEmitterType) => void;
  onSelectLight: (lightId: string) => void;
  onDeleteLight: (lightId: string) => void;
  onUpdateLight: (lightId: string, payload: LightSourceUpdatePayload) => void;
  onWeatherPresetChange: (preset: WeatherPreset) => void;
}

function handlePresetDragStart(
  e: DragEvent<HTMLButtonElement>,
  emitterType: LightEmitterType,
): void {
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData(LIGHT_DRAG_MIME, emitterType);
}

export function LightsSection({
  lights,
  selectedLightId,
  lightsVisible,
  error,
  weatherPreset,
  onToggleVisibility,
  onAddPreset,
  onSelectLight,
  onDeleteLight,
  onUpdateLight,
  onWeatherPresetChange,
}: LightsSectionProps): ReactElement {
  const selectedLight = lights.find((l) => l.id === selectedLightId) ?? null;

  return (
    <>
      <div className={styles.body}>
        <div className={styles.controls}>
          <span className={styles.sectionLabel}>Presets</span>
          <button
            type="button"
            title="Show lights"
            aria-label="Show lights"
            aria-pressed={lightsVisible}
            className={`${styles.iconBtn} ${lightsVisible ? '' : styles.iconBtnOff}`}
            onClick={onToggleVisibility}
          >
            {lightsVisible ? '👁' : '🚫'}
          </button>
        </div>

        <ul className={styles.palette} aria-label="Light presets">
          {LIGHT_EMITTER_TYPES.map((emitterType) => {
            const preset = LIGHT_PRESETS[emitterType];
            return (
              <li key={emitterType}>
                <button
                  type="button"
                  draggable
                  className={`${styles.preset} ${TONE_CLASS[preset.tone]}`}
                  title={`Drag ${preset.label} onto the map, or click to add at the view centre`}
                  onDragStart={(e) => handlePresetDragStart(e, emitterType)}
                  onClick={() => onAddPreset(emitterType)}
                >
                  <span
                    className={styles.swatch}
                    style={{ background: preset.color }}
                    aria-hidden="true"
                  />
                  {preset.label}
                </button>
              </li>
            );
          })}
        </ul>
        <p className={styles.hint}>
          Drag a preset onto the map (Alt bypasses snapping) or click to add at the view centre
        </p>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {lights.length === 0 ? (
          <p className={styles.placeholder}>No lights on this scene.</p>
        ) : (
          <ul className={styles.list} aria-label="Lights">
            {lights.map((light, index) => {
              const isSelected = light.id === selectedLightId;
              const name = `${LIGHT_PRESETS[light.emitterType].label} ${index + 1}`;
              return (
                <li
                  key={light.id}
                  className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className={styles.selectBtn}
                    onClick={() => onSelectLight(light.id)}
                  >
                    <span
                      className={styles.swatch}
                      style={{ background: light.color }}
                      aria-hidden="true"
                    />
                    <span className={styles.name}>{name}</span>
                  </button>
                  <button
                    type="button"
                    title="Delete light"
                    aria-label={`Delete ${name}`}
                    className={`${styles.iconBtn} ${styles.iconBtnDelete}`}
                    onClick={() => onDeleteLight(light.id)}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <label className={styles.atmosphere}>
          <span className={styles.sectionLabel}>Default weather</span>
          <select
            className={styles.select}
            value={weatherPreset ?? ''}
            disabled={weatherPreset === null}
            onChange={(e) => onWeatherPresetChange(e.target.value as WeatherPreset)}
          >
            {weatherPreset === null && <option value="">Loading…</option>}
            {WEATHER_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {WEATHER_LABEL[preset]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <LightInspector light={selectedLight} onUpdate={onUpdateLight} onDelete={onDeleteLight} />
    </>
  );
}
