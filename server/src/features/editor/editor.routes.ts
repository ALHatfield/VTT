// Editor routes — Phase 5A / 5B
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

import {
  assetCategorySchema,
  assetUploadPayloadSchema,
  createTilePlacementSchema,
  updateTilePlacementSchema,
} from '@vtt/shared';
import { Router } from 'express';
import multer from 'multer';

import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireCampaignRole } from '../campaigns/campaigns.middleware.js';
import {
  createTileAsset,
  createTilePlacement,
  deleteTileAsset,
  deleteTilePlacement,
  generateThumbnail,
  getTileAsset,
  listTileAssets,
  listTilePlacements,
  updateTilePlacement,
} from './editor.service.js';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Derive extension from the validated MIME type — never from user-supplied filename
// to prevent extension-spoofing attacks (e.g. Content-Type: image/png + filename: xss.html)
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const router = Router({ mergeParams: true });

router.use(requireAuth);

// Multer — disk storage in uploads/assets/
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, join(process.cwd(), 'uploads', 'assets'));
  },
  filename(_req, file, cb) {
    // Use MIME-derived extension, never file.originalname, to prevent spoofing
    const ext = MIME_TO_EXT[file.mimetype] ?? '.bin';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG, and WebP images are allowed'));
    }
  },
});

/**
 * POST /api/campaigns/:id/assets
 * Upload a new tile asset — DM only
 * Multipart: file + body field `category`
 */
router.post(
  '/:id/assets',
  requireCampaignRole('dm'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: { code: 'NO_FILE', message: 'No file uploaded' } });
      return;
    }

    const result = assetUploadPayloadSchema.safeParse(req.body);
    if (!result.success) {
      // Clean up the uploaded file on validation failure
      await unlink(req.file.path).catch(() => undefined);
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid upload payload',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { category } = result.data;
    const { path: filePath, filename, mimetype } = req.file;

    // Derive dimensions via sharp
    const { Jimp } = await import('jimp');
    const image = await Jimp.read(filePath);
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    if (width === 0 || height === 0) {
      await unlink(filePath).catch(() => undefined);
      res.status(422).json({
        error: { code: 'INVALID_IMAGE', message: 'Could not read image dimensions' },
      });
      return;
    }

    // Generate thumbnail (same format as source, saved alongside)
    const thumbFilename = `thumb_${filename}`;
    await generateThumbnail(filePath, thumbFilename);

    const campaignId = req.params.id;
    const urlBase = `/uploads`;
    const url = `${urlBase}/assets/${filename}`;
    const thumbnailUrl = `${urlBase}/thumbnails/${thumbFilename}`;

    const asset = await createTileAsset(
      campaignId,
      // Use the server-generated UUID-based filename — never the user-supplied originalname
      filename,
      url,
      thumbnailUrl,
      width,
      height,
      category,
    );

    res.status(201).json({ data: asset });
  }),
);

/**
 * GET /api/campaigns/:id/assets
 * List all tile assets for a campaign (members only)
 * Query: ?category=background|playground|foreground
 */
router.get(
  '/:id/assets',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const campaignId = req.params.id;

    const categoryQuery = req.query.category;
    const categoryResult =
      categoryQuery !== undefined
        ? assetCategorySchema.safeParse(categoryQuery)
        : { success: true as const, data: undefined };

    if (!categoryResult.success) {
      res.status(400).json({
        error: {
          code: 'INVALID_CATEGORY',
          message: 'category must be one of: background, playground, foreground',
        },
      });
      return;
    }

    const assets = await listTileAssets(campaignId, categoryResult.data);
    res.status(200).json({ data: assets });
  }),
);

/**
 * GET /api/campaigns/:id/assets/:assetId
 * Get a single asset (members only)
 */
router.get(
  '/:id/assets/:assetId',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    const asset = await getTileAsset(req.params.id, req.params.assetId);
    if (!asset) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } });
      return;
    }
    res.status(200).json({ data: asset });
  }),
);

/**
 * DELETE /api/campaigns/:id/assets/:assetId
 * Delete an asset — DM only; built-in assets cannot be deleted
 */
router.delete(
  '/:id/assets/:assetId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    let paths: { url: string; thumbnailUrl: string } | null;
    try {
      paths = await deleteTileAsset(req.params.id, req.params.assetId);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'BUILTIN_ASSET') {
        res.status(403).json({ error: { code, message: (err as Error).message } });
        return;
      }
      throw err;
    }

    if (!paths) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } });
      return;
    }

    // Best-effort file cleanup — don't fail the request if files are missing
    const uploadsRoot = join(process.cwd(), 'uploads');
    await Promise.allSettled([
      unlink(join(uploadsRoot, paths.url.replace('/uploads/', ''))),
      unlink(join(uploadsRoot, paths.thumbnailUrl.replace('/uploads/', ''))),
    ]);

    res.status(204).send();
  }),
);

export { router as editorRouter };

// ---------------------------------------------------------------------------
// Phase 5B — Tile placement routes
// Mounted at app.use('/api/campaigns', placementsRouter)
// ---------------------------------------------------------------------------

const placementsRouter = Router();
placementsRouter.use(requireAuth);

/**
 * GET /api/campaigns/:id/scenes/:sceneId/placements
 * List all tile placements on a scene (members)
 */
placementsRouter.get(
  '/:id/scenes/:sceneId/placements',
  requireCampaignRole('member'),
  asyncHandler(async (req, res) => {
    try {
      const placements = await listTilePlacements(req.params.id, req.params.sceneId);
      res.status(200).json({ data: placements });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'SCENE_NOT_FOUND') {
        res.status(404).json({ error: { code: 'SCENE_NOT_FOUND', message: 'Scene not found' } });
        return;
      }
      throw err;
    }
  }),
);

/**
 * POST /api/campaigns/:id/scenes/:sceneId/placements
 * Create a tile placement — DM only
 */
placementsRouter.post(
  '/:id/scenes/:sceneId/placements',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = createTilePlacementSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid placement payload',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    try {
      const placement = await createTilePlacement(req.params.id, req.params.sceneId, result.data);
      res.status(201).json({ data: placement });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ASSET_NOT_FOUND' || code === 'SCENE_NOT_FOUND') {
        res.status(404).json({ error: { code, message: (err as Error).message } });
        return;
      }
      throw err;
    }
  }),
);

/**
 * PATCH /api/campaigns/:id/scenes/:sceneId/placements/:placementId
 * Update a tile placement — DM only
 */
placementsRouter.patch(
  '/:id/scenes/:sceneId/placements/:placementId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = updateTilePlacementSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update payload',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const placement = await updateTilePlacement(
      req.params.id,
      req.params.sceneId,
      req.params.placementId,
      result.data,
    );
    if (!placement) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Placement not found' } });
      return;
    }
    res.status(200).json({ data: placement });
  }),
);

/**
 * DELETE /api/campaigns/:id/scenes/:sceneId/placements/:placementId
 * Delete a tile placement — DM only
 */
placementsRouter.delete(
  '/:id/scenes/:sceneId/placements/:placementId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const deleted = await deleteTilePlacement(
      req.params.id,
      req.params.sceneId,
      req.params.placementId,
    );
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Placement not found' } });
      return;
    }
    res.status(204).send();
  }),
);

export { placementsRouter };
