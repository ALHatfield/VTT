import { useEffect, useState, type ReactElement } from 'react';

import type { ExplorationMode, FogEdgeSoftness, FogMaskConfig, FogMode } from '@vtt/shared';
import { FOG_MASK_RESOLUTION_MAX, FOG_MASK_RESOLUTION_MIN } from '@vtt/shared';

import styles from './FogSettingsPanel.module.css';

interface FogSettingsPanelProps {
  config: FogMaskConfig;
  onChange: (patch: Partial<FogMaskConfig>) => void;
  onResetExploration: () => void;
}

type SliderKey = 'maskResolutionScale' | 'shroudAlpha' | 'hiddenAlpha';

const RESOLUTION_STEP = 0.05;
const ALPHA_STEP = 0.05;

/**
 * DM-only controls for the PM2 fog mask pipeline (Phase PM2).
 * `legacy` keeps the Phase 4F polygon renderer as a rollback path.
 *
 * Slider positions are held locally and only committed on release, so dragging
 * does not fire one PATCH plus one room-wide broadcast per pixel.
 */
export function FogSettingsPanel({
  config,
  onChange,
  onResetExploration,
}: FogSettingsPanelProps): ReactElement {
  const isPm2 = config.fogMode === 'pm2';
  const [draft, setDraft] = useState<Pick<FogMaskConfig, SliderKey>>({
    maskResolutionScale: config.maskResolutionScale,
    shroudAlpha: config.shroudAlpha,
    hiddenAlpha: config.hiddenAlpha,
  });

  useEffect(() => {
    setDraft({
      maskResolutionScale: config.maskResolutionScale,
      shroudAlpha: config.shroudAlpha,
      hiddenAlpha: config.hiddenAlpha,
    });
  }, [config.maskResolutionScale, config.shroudAlpha, config.hiddenAlpha]);

  const renderSlider = (
    key: SliderKey,
    label: string,
    step: number,
    min: number,
    max: number,
  ): ReactElement => {
    const commit = (): void => {
      if (draft[key] !== config[key]) onChange({ [key]: draft[key] });
    };

    return (
      <label className={styles.row}>
        <span className={styles.label}>
          {label} {Math.round(draft[key] * 100)}%
        </span>
        <input
          className={styles.slider}
          type="range"
          min={min}
          max={max}
          step={step}
          value={draft[key]}
          onChange={(e) => setDraft((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
      </label>
    );
  };

  return (
    <div className={styles.panel}>
      <label className={styles.row}>
        <span className={styles.label}>Renderer</span>
        <select
          className={styles.select}
          value={config.fogMode}
          onChange={(e) => onChange({ fogMode: e.target.value as FogMode })}
        >
          <option value="legacy">Legacy polygons</option>
          <option value="pm2">Mask pipeline</option>
        </select>
      </label>

      {isPm2 && (
        <>
          <label className={styles.row}>
            <span className={styles.label}>Exploration</span>
            <select
              className={styles.select}
              value={config.explorationMode}
              onChange={(e) => onChange({ explorationMode: e.target.value as ExplorationMode })}
            >
              <option value="off">Off</option>
              <option value="persistent">Persistent</option>
            </select>
          </label>

          <label className={styles.row}>
            <span className={styles.label}>Edge softness</span>
            <select
              className={styles.select}
              value={config.edgeSoftness}
              onChange={(e) => onChange({ edgeSoftness: e.target.value as FogEdgeSoftness })}
            >
              <option value="off">Hard</option>
              <option value="radial">Radial</option>
              <option value="filter">Blur filter</option>
            </select>
          </label>

          {renderSlider(
            'maskResolutionScale',
            'Mask quality',
            RESOLUTION_STEP,
            FOG_MASK_RESOLUTION_MIN,
            FOG_MASK_RESOLUTION_MAX,
          )}
          {renderSlider('shroudAlpha', 'Shroud', ALPHA_STEP, 0, 1)}
          {renderSlider('hiddenAlpha', 'Hidden', ALPHA_STEP, 0, 1)}

          <button
            type="button"
            className={styles.resetBtn}
            disabled={config.explorationMode === 'off'}
            onClick={onResetExploration}
          >
            Reset exploration
          </button>
        </>
      )}
    </div>
  );
}
