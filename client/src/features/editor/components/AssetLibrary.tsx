// AssetLibrary — Phase 5A
// Browsable gallery with upload, category filter, and drag handles
import type { DragEvent, ReactElement } from 'react';
import { useState } from 'react';

import type { AssetCategory, TileAsset } from '@vtt/shared';
import { ASSET_CATEGORIES } from '@vtt/shared';

import styles from './AssetLibrary.module.css';
import { AssetUploadZone } from './AssetUploadZone';

interface AssetLibraryProps {
  assets: TileAsset[];
  isLoading: boolean;
  error: string | null;
  isDm: boolean;
  onUpload: (file: File, category: AssetCategory) => Promise<TileAsset>;
  onDelete: (assetId: string) => Promise<void>;
}

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  background: 'BG',
  playground: 'Play',
  foreground: 'FG',
};

export function AssetLibrary({
  assets,
  isLoading,
  error,
  isDm,
  onUpload,
  onDelete,
}: AssetLibraryProps): ReactElement {
  const [activeCategory, setActiveCategory] = useState<AssetCategory | 'all'>('all');

  const filteredAssets =
    activeCategory === 'all' ? assets : assets.filter((a) => a.category === activeCategory);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, asset: TileAsset): void => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/vtt-asset', JSON.stringify(asset));
  };

  const handleDelete = async (assetId: string): Promise<void> => {
    if (!window.confirm('Delete this asset? This cannot be undone.')) return;
    try {
      await onDelete(assetId);
    } catch {
      // Errors are surfaced via the parent hook's error state
    }
  };

  return (
    <aside className={styles.library}>
      <div className={styles.header}>
        <h2 className={styles.title}>Asset Library</h2>
        <div className={styles.categoryTabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'all'}
            className={`${styles.tab} ${activeCategory === 'all' ? styles.tabActive : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All
          </button>
          {ASSET_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              className={`${styles.tab} ${activeCategory === cat ? styles.tabActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {isDm && (
        <div className={styles.uploadSection}>
          <span className={styles.uploadLabel}>Upload</span>
          <AssetUploadZone onUpload={onUpload} />
        </div>
      )}

      <div className={styles.grid}>
        {isLoading && <div className={styles.loading}>Loading assets…</div>}
        {error && <div className={styles.errorMsg}>{error}</div>}
        {!isLoading && !error && filteredAssets.length === 0 && (
          <div className={styles.empty}>
            {assets.length === 0
              ? 'No assets yet. Upload to get started.'
              : 'No assets in this category.'}
          </div>
        )}
        {filteredAssets.map((asset) => (
          <div
            key={asset.id}
            className={styles.tile}
            draggable
            onDragStart={(e) => handleDragStart(e, asset)}
            title={asset.filename}
            aria-label={`Asset: ${asset.filename}`}
          >
            <img
              src={asset.thumbnailUrl}
              alt={asset.filename}
              className={styles.tileImg}
              loading="lazy"
            />
            <span className={styles.tileLabel}>{asset.filename}</span>
            {isDm && asset.source !== 'builtin' && (
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => void handleDelete(asset.id)}
                aria-label={`Delete ${asset.filename}`}
                title="Delete asset"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
