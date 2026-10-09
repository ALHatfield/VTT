import type { DragEvent, ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { LightEmitterType, TemporaryLight } from '@vtt/shared';
import { LIGHT_PRESETS } from '@vtt/shared';

import { TEMPORARY_LIGHT_DRAG_MIME } from '../hooks/useTemporaryLightDrop';

import styles from './TemporaryLightsPanel.module.css';

const PLACEABLE_EMITTERS: LightEmitterType[] = ['torch', 'lantern', 'fireplace', 'beacon'];
const INTENSITY_STEP = 0.05;

interface IntensitySliderProps {
  label: string;
  intensity: number;
  onCommit: (intensity: number) => void;
}

function IntensitySlider({ label, intensity, onCommit }: IntensitySliderProps): ReactElement {
  const [value, setValue] = useState(intensity);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setValue(intensity);
  }, [intensity, isEditing]);

  // Commit on release/blur only, so a drag sends one update instead of dozens
  const commit = (): void => {
    setIsEditing(false);
    if (value !== intensity) onCommit(value);
  };

  return (
    <input
      type="range"
      className={styles.intensity}
      aria-label={label}
      min={0}
      max={1}
      step={INTENSITY_STEP}
      value={value}
      onChange={(e) => {
        setIsEditing(true);
        setValue(Number(e.target.value));
      }}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  );
}

interface TemporaryLightsPanelProps {
  lights: TemporaryLight[];
  onIntensityChange: (lightId: string, intensity: number) => void;
  onDelete: (lightId: string) => void;
}

export function TemporaryLightsPanel({
  lights,
  onIntensityChange,
  onDelete,
}: TemporaryLightsPanelProps): ReactElement {
  return (
    <div className={styles.panel}>
      <span className={styles.hint}>Drag onto map</span>
      {PLACEABLE_EMITTERS.map((type) => (
        <div
          key={type}
          className={styles.dragItem}
          draggable
          role="button"
          aria-label={`${LIGHT_PRESETS[type].label} — drag to canvas`}
          title={`Drag to place a temporary ${LIGHT_PRESETS[type].label.toLowerCase()}`}
          onDragStart={(e: DragEvent<HTMLDivElement>): void => {
            e.dataTransfer.setData(TEMPORARY_LIGHT_DRAG_MIME, type);
            e.dataTransfer.effectAllowed = 'copy';
          }}
        >
          {LIGHT_PRESETS[type].label}
        </div>
      ))}
      {lights.length > 0 && (
        <ul className={styles.list} aria-label="Temporary lights">
          {lights.map((light, index) => {
            const name = `${LIGHT_PRESETS[light.emitterType].label} ${index + 1}`;
            return (
              <li key={light.id} className={styles.item}>
                <span className={styles.itemName}>{name}</span>
                <IntensitySlider
                  label={`Intensity for ${name}`}
                  intensity={light.intensity}
                  onCommit={(intensity) => onIntensityChange(light.id, intensity)}
                />
                <button
                  type="button"
                  className={styles.deleteBtn}
                  aria-label={`Remove ${name}`}
                  onClick={() => onDelete(light.id)}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
