// LayersPanel — Phase 5A placeholder (full implementation in Phase 5C)
import type { ReactElement } from 'react';
import { useState } from 'react';

import styles from './LayersPanel.module.css';

type LayerTab = 'background' | 'playground' | 'foreground';

const TABS: { id: LayerTab; label: string }[] = [
  { id: 'background', label: 'BG' },
  { id: 'playground', label: 'Play' },
  { id: 'foreground', label: 'FG' },
];

export function LayersPanel(): ReactElement {
  const [activeTab, setActiveTab] = useState<LayerTab>('background');

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Layers</h2>
        <div className={styles.tabs} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.placeholder}>
          Layer management coming in Phase 5C.
        </div>
      </div>
    </aside>
  );
}
