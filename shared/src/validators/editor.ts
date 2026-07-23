// Editor shared validators — Phase 5A / 5B

import { z } from 'zod';

import { ASSET_CATEGORIES } from '../constants/editor.js';

export const assetCategorySchema = z.enum(ASSET_CATEGORIES);

export const assetUploadPayloadSchema = z.object({
  category: assetCategorySchema,
});

// ---------------------------------------------------------------------------
// Phase 5B — Tile placement validators
// ---------------------------------------------------------------------------

export const createTilePlacementSchema = z.object({
  assetId: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().finite().min(-360).max(360).default(0),
  zIndex: z.number().int().default(0),
  category: assetCategorySchema,
});

export const updateTilePlacementSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().finite().min(-360).max(360),
    zIndex: z.number().int(),
    category: assetCategorySchema,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
