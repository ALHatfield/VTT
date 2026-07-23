// Editor shared constants — Phase 5A / 5B

/** Allowed MIME types for asset uploads */
export const ALLOWED_ASSET_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Allowed file extensions for asset uploads */
export const ALLOWED_ASSET_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const;

/** Maximum file size for asset uploads (10 MB) */
export const MAX_ASSET_FILE_SIZE = 10 * 1024 * 1024;

/** Thumbnail dimensions (px) — maintains aspect ratio, fits within this box */
export const THUMBNAIL_MAX_WIDTH = 200;
export const THUMBNAIL_MAX_HEIGHT = 200;

/** Valid asset categories */
export const ASSET_CATEGORIES = ['background', 'playground', 'foreground'] as const;

/** Auto-save debounce delay for tile placement changes (ms) */
export const PLACEMENT_AUTOSAVE_DEBOUNCE_MS = 500;
