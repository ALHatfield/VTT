import { z } from 'zod';

import {
    DICE_FORMULA_MAX_LENGTH,
    DICE_MACRO_NAME_MAX_LENGTH,
    DICE_SKIN_MATERIALS,
    ROLL_LABEL_MAX_LENGTH,
    ROLL_VISIBILITIES,
} from '../constants/dice.js';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Dice payload schema (Phase 4E; label added in characters 6C)
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
  label: z
    .string()
    .trim()
    .min(1)
    .max(
      ROLL_LABEL_MAX_LENGTH,
      `Label must be ${ROLL_LABEL_MAX_LENGTH.toString()} characters or fewer`,
    )
    .optional(),
});

export type DiceRollInput = z.infer<typeof diceRollPayloadSchema>;

export const rollVisibilitySchema = z.enum(ROLL_VISIBILITIES);

// Structural check only — the server's expression parser validates the grammar (Phase 9A)
const formulaSchema = z
  .string()
  .trim()
  .min(1, 'Formula is required')
  .max(DICE_FORMULA_MAX_LENGTH, `Formula must be ${DICE_FORMULA_MAX_LENGTH.toString()} characters or fewer`);

const macroNameSchema = z
  .string()
  .trim()
  .min(1, 'Macro name is required')
  .max(DICE_MACRO_NAME_MAX_LENGTH, `Name must be ${DICE_MACRO_NAME_MAX_LENGTH.toString()} characters or fewer`);

/**
 * Schema for creating a dice macro
 */
export const diceMacroCreatePayloadSchema = z
  .object({
    name: macroNameSchema,
    formula: formulaSchema,
    visibility: rollVisibilitySchema.optional(),
    campaignId: z.string().uuid().optional(),
    characterId: z.string().uuid().optional(),
  })
  .strict();

/**
 * Schema for updating a dice macro — at least one field must be provided
 */
export const diceMacroUpdatePayloadSchema = z
  .object({
    name: macroNameSchema.optional(),
    formula: formulaSchema.optional(),
    visibility: rollVisibilitySchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided' },
  );

/**
 * Schema for updating the caller's dice skin — at least one field must be provided
 */
export const diceSkinUpdatePayloadSchema = z
  .object({
    bodyColor: z.string().regex(HEX_COLOR_PATTERN, 'Color must be a 6-digit hex value').optional(),
    labelColor: z.string().regex(HEX_COLOR_PATTERN, 'Color must be a 6-digit hex value').optional(),
    material: z.enum(DICE_SKIN_MATERIALS).optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided' },
  );

export type DiceMacroCreateInput = z.infer<typeof diceMacroCreatePayloadSchema>;
export type DiceMacroUpdateInput = z.infer<typeof diceMacroUpdatePayloadSchema>;
export type DiceSkinUpdateInput = z.infer<typeof diceSkinUpdatePayloadSchema>;
