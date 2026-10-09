// Scene library routes — Phase 5H
// Mounted at app.use('/api/campaigns', scenesRouter). All routes are DM-only.
import type { Response } from 'express';
import { Router } from 'express';
import multer from 'multer';

import {
    ALLOWED_SCENE_THUMBNAIL_MIME_TYPES,
    MAX_SCENE_THUMBNAIL_FILE_SIZE,
    sceneCreateSchema,
    sceneReorderSchema,
    sceneUpdateSchema,
} from '@vtt/shared';

import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireCampaignRole } from '../campaigns/campaigns.middleware.js';
import type { SceneErrorCode } from './scenes.service.js';
import {
    SceneServiceError,
    createScene,
    deleteScene,
    duplicateScene,
    listScenes,
    reorderScenes,
    setSceneThumbnail,
    updateScene,
} from './scenes.service.js';

const SCENE_ERROR_STATUS: Record<SceneErrorCode, number> = {
  SCENE_NOT_FOUND: 404,
  SCENE_ACTIVE: 409,
  LAST_SCENE: 409,
  INVALID_ORDER: 400,
  INVALID_IMAGE: 422,
};

const router = Router();

router.use(requireAuth);

/** Send a structured response for known service errors; returns false for unknown errors. */
function sendSceneError(res: Response, err: unknown): boolean {
  if (!(err instanceof SceneServiceError)) return false;
  res.status(SCENE_ERROR_STATUS[err.code]).json({ error: { code: err.code, message: err.message } });
  return true;
}

function sendValidationError(res: Response, message: string, details: unknown): void {
  res.status(400).json({ error: { code: 'VALIDATION_ERROR', message, details } });
}

// Thumbnails are small and immediately re-encoded, so buffer them in memory
const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SCENE_THUMBNAIL_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if ((ALLOWED_SCENE_THUMBNAIL_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and WebP images are allowed'));
    }
  },
});

/**
 * GET /api/campaigns/:id/scenes
 * List the campaign's scenes ordered by sortOrder — DM only
 */
router.get(
  '/:id/scenes',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const scenes = await listScenes(req.params.id);
    res.status(200).json({ data: scenes });
  }),
);

/**
 * POST /api/campaigns/:id/scenes
 * Create a scene appended to the end of the order — DM only
 */
router.post(
  '/:id/scenes',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = sceneCreateSchema.safeParse(req.body);
    if (!result.success) {
      sendValidationError(res, 'Invalid scene payload', result.error.flatten().fieldErrors);
      return;
    }
    const scene = await createScene(req.params.id, result.data);
    res.status(201).json({ data: scene });
  }),
);

/**
 * PUT /api/campaigns/:id/scenes/order
 * Reorder scenes in one transaction — DM only.
 * Registered before /:sceneId routes so 'order' is never read as a scene ID.
 */
router.put(
  '/:id/scenes/order',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = sceneReorderSchema.safeParse(req.body);
    if (!result.success) {
      sendValidationError(res, 'Invalid reorder payload', result.error.flatten().fieldErrors);
      return;
    }
    try {
      const scenes = await reorderScenes(req.params.id, result.data);
      res.status(200).json({ data: scenes });
    } catch (err) {
      if (!sendSceneError(res, err)) throw err;
    }
  }),
);

/**
 * PATCH /api/campaigns/:id/scenes/:sceneId
 * Rename a scene or update width/height/cellSize — DM only
 */
router.patch(
  '/:id/scenes/:sceneId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    const result = sceneUpdateSchema.safeParse(req.body);
    if (!result.success) {
      sendValidationError(res, 'Invalid scene payload', result.error.flatten().fieldErrors);
      return;
    }
    try {
      const scene = await updateScene(req.params.id, req.params.sceneId, result.data);
      res.status(200).json({ data: scene });
    } catch (err) {
      if (!sendSceneError(res, err)) throw err;
    }
  }),
);

/**
 * DELETE /api/campaigns/:id/scenes/:sceneId
 * Delete a scene — DM only; rejects the active scene and the last scene (409)
 */
router.delete(
  '/:id/scenes/:sceneId',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    try {
      await deleteScene(req.params.id, req.params.sceneId);
      res.status(204).end();
    } catch (err) {
      if (!sendSceneError(res, err)) throw err;
    }
  }),
);

/**
 * POST /api/campaigns/:id/scenes/:sceneId/duplicate
 * Deep-copy a scene's authored content — DM only
 */
router.post(
  '/:id/scenes/:sceneId/duplicate',
  requireCampaignRole('dm'),
  asyncHandler(async (req, res) => {
    try {
      const scene = await duplicateScene(req.params.id, req.params.sceneId);
      res.status(201).json({ data: scene });
    } catch (err) {
      if (!sendSceneError(res, err)) throw err;
    }
  }),
);

/**
 * PUT /api/campaigns/:id/scenes/:sceneId/thumbnail
 * Upload a PNG/WebP thumbnail, re-encoded server-side to WebP — DM only
 */
router.put(
  '/:id/scenes/:sceneId/thumbnail',
  requireCampaignRole('dm'),
  (req, res, next) => {
    // Map multer rejections (bad MIME, oversize) to structured errors instead of a generic 500
    thumbnailUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const isTooLarge = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
        const message = err instanceof Error ? err.message : 'Upload failed';
        res
          .status(isTooLarge ? 413 : 400)
          .json({ error: { code: isTooLarge ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD', message } });
        return;
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: { code: 'NO_FILE', message: 'No file uploaded' } });
      return;
    }
    try {
      const scene = await setSceneThumbnail(req.params.id, req.params.sceneId, req.file.buffer);
      res.status(200).json({ data: scene });
    } catch (err) {
      if (!sendSceneError(res, err)) throw err;
    }
  }),
);

export { router as scenesRouter };
