// Editor shared validators — Phase 5A / 5B

import { z } from 'zod';

import {
    ASSET_CATEGORIES,
    LIGHT_ANIMATION_MODES,
    LIGHT_COORDINATE_LIMIT,
    LIGHT_EMITTER_TYPES,
    LIGHT_RADIUS_MAX,
    LIGHT_RADIUS_MIN,
    SCENE_CELL_SIZE_MAX,
    SCENE_CELL_SIZE_MIN,
    SCENE_DIMENSION_MAX,
    SCENE_DIMENSION_MIN,
    SCENE_NAME_MAX_LENGTH,
    SCENE_NAME_MIN_LENGTH,
    WALL_COORDINATE_LIMIT,
    WEATHER_PRESETS,
} from '../constants/editor.js';

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

// ---------------------------------------------------------------------------
// Phase 5F — Wall segment validators
// ---------------------------------------------------------------------------

const wallCoordinateSchema = z
  .number()
  .finite()
  .min(-WALL_COORDINATE_LIMIT)
  .max(WALL_COORDINATE_LIMIT);

export const wallSegmentCreateSchema = z
  .object({
    x1: wallCoordinateSchema,
    y1: wallCoordinateSchema,
    x2: wallCoordinateSchema,
    y2: wallCoordinateSchema,
    blocksLight: z.boolean().default(true),
    blocksMovement: z.boolean().default(true),
    isDoor: z.boolean().default(false),
    isOpen: z.boolean().default(false),
  })
  .strict()
  .refine((data) => data.x1 !== data.x2 || data.y1 !== data.y2, {
    message: 'Wall endpoints must not be identical',
    path: ['x2'],
  })
  .refine((data) => data.isDoor || !data.isOpen, {
    message: 'Only doors can be open',
    path: ['isOpen'],
  });

export const wallSegmentUpdateSchema = z
  .object({
    x1: wallCoordinateSchema,
    y1: wallCoordinateSchema,
    x2: wallCoordinateSchema,
    y2: wallCoordinateSchema,
    blocksLight: z.boolean(),
    blocksMovement: z.boolean(),
    isDoor: z.boolean(),
    isOpen: z.boolean(),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

// ---------------------------------------------------------------------------
// Phase 5G — Light source validators
// ---------------------------------------------------------------------------

export const lightEmitterTypeSchema = z.enum(LIGHT_EMITTER_TYPES);
export const lightAnimationModeSchema = z.enum(LIGHT_ANIMATION_MODES);
export const weatherPresetSchema = z.enum(WEATHER_PRESETS);

const lightCoordinateSchema = z
  .number()
  .finite()
  .min(-LIGHT_COORDINATE_LIMIT)
  .max(LIGHT_COORDINATE_LIMIT);

const lightFieldSchemas = {
  x: lightCoordinateSchema,
  y: lightCoordinateSchema,
  radius: z.number().finite().min(LIGHT_RADIUS_MIN).max(LIGHT_RADIUS_MAX),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a 6-digit hex color'),
  intensity: z.number().finite().min(0).max(1),
  falloff: z.number().finite().min(0).max(1),
  emitterType: lightEmitterTypeSchema,
  animationMode: lightAnimationModeSchema,
  alwaysVisible: z.boolean(),
};

export const lightSourceCreateSchema = z
  .object({
    emitterType: lightFieldSchemas.emitterType,
    x: lightFieldSchemas.x,
    y: lightFieldSchemas.y,
    radius: lightFieldSchemas.radius.optional(),
    color: lightFieldSchemas.color.optional(),
    intensity: lightFieldSchemas.intensity.optional(),
    falloff: lightFieldSchemas.falloff.optional(),
    animationMode: lightFieldSchemas.animationMode.optional(),
    alwaysVisible: lightFieldSchemas.alwaysVisible.optional(),
  })
  .strict();

export const lightSourceUpdateSchema = z
  .object(lightFieldSchemas)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const sceneAtmosphereUpdateSchema = z
  .object({ weatherPreset: weatherPresetSchema })
  .strict();

// ---------------------------------------------------------------------------
// Phase 5H — Scene library validators
// ---------------------------------------------------------------------------

const sceneFieldSchemas = {
  name: z.string().trim().min(SCENE_NAME_MIN_LENGTH).max(SCENE_NAME_MAX_LENGTH),
  width: z.number().int().min(SCENE_DIMENSION_MIN).max(SCENE_DIMENSION_MAX),
  height: z.number().int().min(SCENE_DIMENSION_MIN).max(SCENE_DIMENSION_MAX),
  cellSize: z.number().int().min(SCENE_CELL_SIZE_MIN).max(SCENE_CELL_SIZE_MAX),
};

export const sceneCreateSchema = z
  .object({
    name: sceneFieldSchemas.name,
    width: sceneFieldSchemas.width.optional(),
    height: sceneFieldSchemas.height.optional(),
    cellSize: sceneFieldSchemas.cellSize.optional(),
  })
  .strict();

export const sceneUpdateSchema = z
  .object(sceneFieldSchemas)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const sceneReorderSchema = z
  .object({
    sceneIds: z
      .array(z.string().min(1))
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'sceneIds must not contain duplicates',
      }),
  })
  .strict();
