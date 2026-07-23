// AssetUploadZone — Phase 5A
import type { ChangeEvent, DragEvent, ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';

import type { AssetCategory, TileAsset } from '@vtt/shared';
import { ASSET_CATEGORIES } from '@vtt/shared';

import styles from './AssetUploadZone.module.css';

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

interface AssetUploadZoneProps {
  onUpload: (file: File, category: AssetCategory) => Promise<TileAsset>;
}

export function AssetUploadZone({ onUpload }: AssetUploadZoneProps): ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<AssetCategory>('background');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback((file: File): void => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError('Only PNG, JPEG, and WebP files are allowed');
      return;
    }

    setError(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e): void => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrag = useCallback((e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      const file = e.currentTarget.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleUpload = useCallback(async (): Promise<void> => {
    if (!selectedFile) return;
    setIsUploading(true);
    setError(null);
    try {
      await onUpload(selectedFile, category);
      setPreview(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, category, onUpload]);

  return (
    <div>
      <div
        className={`${styles.zone} ${dragActive ? styles.zoneDragActive : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label="Upload asset — click or drag and drop"
      >
        <span className={styles.zoneText}>
          {dragActive ? 'Drop image here' : 'Click or drag image to upload'}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          className={styles.fileInput}
          onChange={handleInputChange}
        />
      </div>

      {preview && (
        <div className={styles.preview}>
          <img src={preview} alt="Preview" className={styles.previewImg} />
          {selectedFile && (
            <span className={styles.previewInfo}>
              {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
            </span>
          )}
          <select
            className={styles.categorySelect}
            value={category}
            onChange={(e) => setCategory(e.target.value as AssetCategory)}
            aria-label="Asset category"
          >
            {ASSET_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
