import { z } from 'zod';

import {
  CHAT_MESSAGE_MAX_LENGTH,
  DEFAULT_VISION_RADIUS,
  DICE_FORMULA_MAX_LENGTH,
  TOKEN_NAME_MAX_LENGTH,
  TOKEN_SIZE_MAX,
  TOKEN_SIZE_MIN,
  VISION_RADIUS_MAX,
} from '../constants/play-area.js';

const tokenTypeSchema = z.enum(['player', 'monster', 'npc', 'misc']);
const npcSubtypeSchema = z.enum(['ally', 'enemy']);

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
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a 6-digit hex color (e.g. #4a9eff)')
      .optional(),
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
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
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
    npcSubtype: npcSubtypeSchema.nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export type TokenUpdateInput = z.infer<typeof tokenUpdatePayloadSchema>;

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
