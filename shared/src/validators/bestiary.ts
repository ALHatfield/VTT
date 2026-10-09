import { z } from 'zod';

import {
    CREATURE_AC_MAX,
    CREATURE_AC_MIN,
    CREATURE_HP_FORMULA_MAX_LENGTH,
    CREATURE_HP_MAX,
    CREATURE_HP_MIN,
    CREATURE_NAME_MAX_LENGTH,
    CREATURE_NOTES_MAX_LENGTH,
    CREATURE_PORTRAIT_URL_MAX_LENGTH,
    CREATURE_SIZES,
    CREATURE_SPEED_MAX,
    CREATURE_SPEED_MIN,
    CREATURE_TYPE_MAX_LENGTH,
} from '../constants/bestiary.js';
import { ABILITY_SCORE_MAX, ABILITY_SCORE_MIN } from '../constants/characters.js';

const abilityScoreSchema = z.number().int().min(ABILITY_SCORE_MIN).max(ABILITY_SCORE_MAX);

const creatureFieldsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Creature name is required')
      .max(CREATURE_NAME_MAX_LENGTH, `Name must be ${CREATURE_NAME_MAX_LENGTH} characters or fewer`),
    size: z.enum(CREATURE_SIZES),
    creatureType: z
      .string()
      .trim()
      .min(1, 'Creature type is required')
      .max(CREATURE_TYPE_MAX_LENGTH, `Type must be ${CREATURE_TYPE_MAX_LENGTH} characters or fewer`),
    ac: z.number().int().min(CREATURE_AC_MIN).max(CREATURE_AC_MAX),
    maxHp: z.number().int().min(CREATURE_HP_MIN).max(CREATURE_HP_MAX),
    hpFormula: z.string().trim().max(CREATURE_HP_FORMULA_MAX_LENGTH).optional(),
    speed: z.number().int().min(CREATURE_SPEED_MIN).max(CREATURE_SPEED_MAX),
    abilityScores: z.object({
      strength: abilityScoreSchema,
      dexterity: abilityScoreSchema,
      constitution: abilityScoreSchema,
      intelligence: abilityScoreSchema,
      wisdom: abilityScoreSchema,
      charisma: abilityScoreSchema,
    }),
    // Placeholder until the per-system discriminated union lands in Phase 8A
    systemData: z.record(z.string(), z.unknown()).optional(),
    portraitUrl: z
      .string()
      .url()
      .max(CREATURE_PORTRAIT_URL_MAX_LENGTH)
      .refine((url) => /^https?:\/\//.test(url), { message: 'URL must use http or https' })
      .optional(),
    notes: z
      .string()
      .trim()
      .max(CREATURE_NOTES_MAX_LENGTH, `Notes must be ${CREATURE_NOTES_MAX_LENGTH} characters or fewer`)
      .optional(),
  })
  .strict();

/**
 * Schema for creating a creature
 */
export const creatureCreatePayloadSchema = creatureFieldsSchema;

/**
 * Schema for updating a creature — at least one field must be provided
 */
export const creatureUpdatePayloadSchema = creatureFieldsSchema
  .partial()
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided' },
  );

export type CreatureCreateInput = z.infer<typeof creatureCreatePayloadSchema>;
export type CreatureUpdateInput = z.infer<typeof creatureUpdatePayloadSchema>;
