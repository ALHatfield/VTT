import { z } from 'zod';

import {
  AURA_RADIUS_MAX,
  AURA_RADIUS_MIN,
  CHAT_MESSAGE_MAX_LENGTH,
  DEFAULT_VISION_RADIUS,
  DICE_FORMULA_MAX_LENGTH,
  DRAW_WIDTH_MAX,
  DRAW_WIDTH_MIN,
  FOG_MASK_RESOLUTION_MAX,
  FOG_MASK_RESOLUTION_MIN,
  TOKEN_NAME_MAX_LENGTH,
  TOKEN_SIZE_MAX,
  TOKEN_SIZE_MIN,
  VISION_RADIUS_MAX,
} from '../constants/play-area.js';

const tokenTypeSchema = z.enum(['player', 'monster', 'npc', 'misc']);
const npcSubtypeSchema = z.enum(['ally', 'enemy']);
const auraTypeSchema = z.enum(['presence', 'turn', 'condition']);
const auraConditionSchema = z.enum(['stunned', 'poisoned', 'blessed']);
const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a 6-digit hex color (e.g. #4a9eff)');

export const tokenCreatePayloadSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Token name is required')
      .max(TOKEN_NAME_MAX_LENGTH, `Name must be ${TOKEN_NAME_MAX_LENGTH} characters or fewer`),
    type: tokenTypeSchema,
    x: z.number().int().min(0, 'x must be a non-negative integer'),
    y: z.number().int().min(0, 'y must be a non-negative integer'),
    size: z.number().int().min(TOKEN_SIZE_MIN).max(TOKEN_SIZE_MAX).optional(),
    color: hexColorSchema.optional(),
    iconUrl: z
      .string()
      .trim()
      .min(1)
      .regex(
        /^(https?:\/\/|\/)/,
        'iconUrl must be an absolute URL or a root-relative path (e.g. /tokens/foo.png)',
      )
      .optional(),
    hp: z.number().int().min(0).optional(),
    maxHp: z.number().int().min(0).optional(),
    ac: z.number().int().min(0).optional(),
    ownerId: z.string().uuid('ownerId must be a valid UUID').optional(),
    visionRadius: z
      .number()
      .int()
      .min(0)
      .max(VISION_RADIUS_MAX)
      .default(DEFAULT_VISION_RADIUS)
      .optional(),
    auraRadius: z.number().int().min(AURA_RADIUS_MIN).max(AURA_RADIUS_MAX).optional(),
    auraColor: hexColorSchema.optional(),
    auraVisible: z.boolean().optional(),
    auraType: auraTypeSchema.optional(),
    auraCondition: auraConditionSchema.nullable().optional(),
    npcSubtype: npcSubtypeSchema.optional(),
  })
  .refine((d) => d.npcSubtype === undefined || d.type === 'npc', {
    message: 'npcSubtype is only valid when type is "npc"',
    path: ['npcSubtype'],
  });

export type TokenCreateInput = z.infer<typeof tokenCreatePayloadSchema>;

export const tokenUpdatePayloadSchema = z
  .object({
    name: z.string().trim().min(1).max(TOKEN_NAME_MAX_LENGTH).optional(),
    type: tokenTypeSchema.optional(),
    size: z.number().int().min(TOKEN_SIZE_MIN).max(TOKEN_SIZE_MAX).optional(),
    color: hexColorSchema.optional(),
    iconUrl: z
      .string()
      .trim()
      .min(1)
      .regex(
        /^(https?:\/\/|\/)/,
        'iconUrl must be an absolute URL or a root-relative path (e.g. /tokens/foo.png)',
      )
      .nullable()
      .optional(),
    hp: z.number().int().min(0).nullable().optional(),
    maxHp: z.number().int().min(0).nullable().optional(),
    ac: z.number().int().min(0).nullable().optional(),
    visionRadius: z.number().int().min(0).max(VISION_RADIUS_MAX).optional(),
    auraRadius: z.number().int().min(AURA_RADIUS_MIN).max(AURA_RADIUS_MAX).nullable().optional(),
    auraColor: hexColorSchema.nullable().optional(),
    auraVisible: z.boolean().optional(),
    auraType: auraTypeSchema.nullable().optional(),
    auraCondition: auraConditionSchema.nullable().optional(),
    npcSubtype: npcSubtypeSchema.nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export type TokenUpdateInput = z.infer<typeof tokenUpdatePayloadSchema>;

export const auraUpdatePayloadSchema = z.object({
  tokenId: z.string().min(1, 'tokenId is required'),
  campaignId: z.string().min(1, 'campaignId is required'),
  aura: z
    .object({
      radius: z.number().int().min(AURA_RADIUS_MIN).max(AURA_RADIUS_MAX).optional(),
      color: hexColorSchema.optional(),
      visible: z.boolean().optional(),
      type: auraTypeSchema.optional(),
      condition: auraConditionSchema.nullable().optional(),
    })
    .refine((data) => Object.values(data).some((v) => v !== undefined), {
      message: 'At least one aura field must be provided',
    }),
});

export type AuraUpdateInput = z.infer<typeof auraUpdatePayloadSchema>;

export const tokenMovePayloadSchema = z.object({
  x: z.number().int().min(0, 'x must be a non-negative integer'),
  y: z.number().int().min(0, 'y must be a non-negative integer'),
});

export type TokenMoveInput = z.infer<typeof tokenMovePayloadSchema>;

// Socket payload schemas

export const roomJoinPayloadSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
});

export const tokenMoveSocketPayloadSchema = z.object({
  tokenId: z.string().min(1, 'tokenId is required'),
  x: z.number().int().finite().min(0, 'x must be a non-negative integer'),
  y: z.number().int().finite().min(0, 'y must be a non-negative integer'),
  campaignId: z.string().min(1, 'campaignId is required'),
});

export const initiativeStartPayloadSchema = z
  .object({
    campaignId: z.string().min(1, 'campaignId is required'),
    tokenIds: z.array(z.string().min(1, 'tokenId is required')).min(1).optional(),
  })
  .refine(
    (payload) => {
      if (!payload.tokenIds) return true;
      return new Set(payload.tokenIds).size === payload.tokenIds.length;
    },
    {
      message: 'tokenIds must be unique',
      path: ['tokenIds'],
    },
  );

export type InitiativeStartInput = z.infer<typeof initiativeStartPayloadSchema>;

export const initiativeAdvancePayloadSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
});

export type InitiativeAdvanceInput = z.infer<typeof initiativeAdvancePayloadSchema>;

export const initiativeEndPayloadSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
});

export type InitiativeEndInput = z.infer<typeof initiativeEndPayloadSchema>;

export const initiativeReorderPayloadSchema = z
  .object({
    campaignId: z.string().min(1, 'campaignId is required'),
    tokenIds: z
      .array(z.string().min(1, 'tokenId is required'))
      .min(1, 'At least one token is required'),
  })
  .refine((payload) => new Set(payload.tokenIds).size === payload.tokenIds.length, {
    message: 'tokenIds must be unique',
    path: ['tokenIds'],
  });

export type InitiativeReorderInput = z.infer<typeof initiativeReorderPayloadSchema>;

// Chat payload schema (Phase 4D)
export const chatSendPayloadSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
  text: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(
      CHAT_MESSAGE_MAX_LENGTH,
      `Message must be ${CHAT_MESSAGE_MAX_LENGTH.toString()} characters or fewer`,
    ),
});

export type ChatSendInput = z.infer<typeof chatSendPayloadSchema>;

// Dice payload schema (Phase 4E)
export const diceRollPayloadSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
  formula: z
    .string()
    .trim()
    .min(1, 'Formula cannot be empty')
    .max(
      DICE_FORMULA_MAX_LENGTH,
      `Formula must be ${DICE_FORMULA_MAX_LENGTH.toString()} characters or fewer`,
    ),
});

export type DiceRollInput = z.infer<typeof diceRollPayloadSchema>;

// Fog payload schemas (Phase 4F)
const fogVertexSchema = z.object({
  x: z.number().finite().min(0, 'x must be a non-negative number'),
  y: z.number().finite().min(0, 'y must be a non-negative number'),
});

export const fogVerticesSchema = z
  .array(fogVertexSchema)
  .min(3, 'At least 3 vertices are required')
  .max(64, 'Polygon has too many vertices');

export const fogRevealPayloadSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
  sceneId: z.string().min(1, 'sceneId is required'),
  vertices: fogVerticesSchema,
});

export type FogRevealInput = z.infer<typeof fogRevealPayloadSchema>;

export const fogHidePayloadSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
  sceneId: z.string().min(1, 'sceneId is required'),
  vertices: fogVerticesSchema,
});

export type FogHideInput = z.infer<typeof fogHidePayloadSchema>;

export const fogRegionDeletePayloadSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
  sceneId: z.string().min(1, 'sceneId is required'),
  regionId: z.string().min(1, 'regionId is required'),
});

export type FogRegionDeleteInput = z.infer<typeof fogRegionDeletePayloadSchema>;

// Fog mask pipeline validators (Phase PM2)

export const fogModeSchema = z.enum(['legacy', 'pm2']);
export const explorationModeSchema = z.enum(['off', 'persistent']);
export const fogEdgeSoftnessSchema = z.enum(['off', 'radial', 'filter']);

const unitIntervalSchema = z.number().finite().min(0).max(1);

export const fogMaskConfigSchema = z.object({
  fogMode: fogModeSchema,
  explorationMode: explorationModeSchema,
  edgeSoftness: fogEdgeSoftnessSchema,
  maskResolutionScale: z
    .number()
    .finite()
    .min(FOG_MASK_RESOLUTION_MIN, 'maskResolutionScale is too small')
    .max(FOG_MASK_RESOLUTION_MAX, 'maskResolutionScale is too large'),
  shroudAlpha: unitIntervalSchema,
  hiddenAlpha: unitIntervalSchema,
  edgeSoftnessRatio: unitIntervalSchema,
});

export type FogMaskConfigInput = z.infer<typeof fogMaskConfigSchema>;

export const fogMaskConfigPatchSchema = fogMaskConfigSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'At least one fog setting is required');

// Measure tool validators (Phase 4J)

export const measureBroadcastPayloadSchema = z.object({
  campaignId: z.string().uuid('campaignId must be a valid UUID'),
  startX: z.number().finite(),
  startY: z.number().finite(),
  endX: z.number().finite(),
  endY: z.number().finite(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a 6-digit hex color'),
  isPrivate: z.boolean(),
});

export type MeasureBroadcastInput = z.infer<typeof measureBroadcastPayloadSchema>;

export const measureClearPayloadSchema = z.object({
  campaignId: z.string().uuid('campaignId must be a valid UUID'),
  isPrivate: z.boolean(),
});

export type MeasureClearInput = z.infer<typeof measureClearPayloadSchema>;

// Drawing tool validators (Phase 4K)

const DRAW_COORD_MAX = 100_000;

const drawPointSchema = z.object({
  x: z.number().finite().min(-DRAW_COORD_MAX).max(DRAW_COORD_MAX),
  y: z.number().finite().min(-DRAW_COORD_MAX).max(DRAW_COORD_MAX),
});

export const drawStrokePayloadSchema = z.object({
  campaignId: z.string().uuid('campaignId must be a valid UUID'),
  strokeId: z.string().min(1, 'strokeId is required').max(64),
  points: z.array(drawPointSchema).min(1, 'At least one point required').max(2000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a 6-digit hex color'),
  width: z.number().int().min(DRAW_WIDTH_MIN).max(DRAW_WIDTH_MAX),
  shapeType: z.enum(['freehand', 'rect', 'circle']),
  isFinal: z.boolean(),
});

export type DrawStrokeInput = z.infer<typeof drawStrokePayloadSchema>;

export const drawClearPayloadSchema = z.object({
  campaignId: z.string().uuid('campaignId must be a valid UUID'),
  scope: z.enum(['all', 'own']),
});
