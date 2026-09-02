import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { EditorMode } from '@vtt/shared';

import styles from './CampaignToolbar.module.css';

interface CampaignToolbarProps {
  editorMode: EditorMode;
  canToggleEditor: boolean;
  onToggleEditor: () => void;
}

export function CampaignToolbar({
  editorMode,
  canToggleEditor,
  onToggleEditor,
}: CampaignToolbarProps): ReactElement {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            if (campaignId) navigate(`/campaigns/${campaignId}`);
          }}
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
        <button type="button" className={styles.iconBtn} disabled title="Settings (coming soon)">
          ⚙
        </button>
        {editorMode === 'play' && (
          <button
            type="button"
            className={styles.iconBtn}
            disabled
            title="Initiative (coming soon)"
          >
            ⚔
          </button>
        )}
        {editorMode === 'editor' && <span className={styles.editorBadge}>EDITOR MODE</span>}
      </div>
    </div>
  );
}
