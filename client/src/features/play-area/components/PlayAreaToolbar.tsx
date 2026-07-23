import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { EditorMode } from '@vtt/shared';

import styles from './PlayAreaToolbar.module.css';

export type FogToolMode = 'off' | 'reveal' | 'hide';

interface PlayAreaToolbarProps {
  canUseFogTools: boolean;
  fogMode: FogToolMode;
  onFogModeChange: (mode: FogToolMode) => void;
  editorMode: EditorMode;
  canToggleEditor: boolean;
  onToggleEditor: () => void;
}

export function PlayAreaToolbar({
  canUseFogTools,
  fogMode,
  onFogModeChange,
  editorMode,
  canToggleEditor,
  onToggleEditor,
}: PlayAreaToolbarProps): ReactElement {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => navigate(`/campaigns/${campaignId ?? ''}`)}
        >
          ← Back
        </button>
        <button type="button" className={styles.btn} disabled title="Coming soon">
          Campaign Notes
        </button>
        <button type="button" className={styles.btn} disabled title="Coming soon">
          Inventory
        </button>
        {canToggleEditor && (
          <button
            type="button"
            className={`${styles.btn} ${editorMode === 'editor' ? styles.btnActive : ''}`}
            onClick={onToggleEditor}
            title={editorMode === 'editor' ? 'Return to play mode' : 'Open scene editor (DM only)'}
          >
            {editorMode === 'editor' ? '← Play Area' : '✏ Editor'}
          </button>
        )}
      </div>
      <div className={styles.right}>
        {/* Placeholder icon slots — wired up in later phases */}
        <button type="button" className={styles.iconBtn} disabled title="Settings (coming soon)">
          ⚙
        </button>
        {editorMode === 'play' && (
          <>
            <button
              type="button"
              className={`${styles.iconBtn} ${fogMode === 'reveal' ? styles.active : ''}`}
              disabled={!canUseFogTools}
              title={canUseFogTools ? 'Reveal fog area' : 'DM only'}
              onClick={() => onFogModeChange(fogMode === 'reveal' ? 'off' : 'reveal')}
            >
              Reveal
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${fogMode === 'hide' ? styles.active : ''}`}
              disabled={!canUseFogTools}
              title={canUseFogTools ? 'Hide fog area' : 'DM only'}
              onClick={() => onFogModeChange(fogMode === 'hide' ? 'off' : 'hide')}
            >
              Hide
            </button>
            <button type="button" className={styles.iconBtn} disabled title="Initiative (coming soon)">
              ⚔
            </button>
          </>
        )}
        {editorMode === 'editor' && (
          <span className={styles.editorBadge}>EDITOR MODE</span>
        )}
      </div>
    </div>
  );
}
