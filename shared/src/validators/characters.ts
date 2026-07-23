import { z } from 'zod';

import {
    ABILITY_SCORE_MAX,
    ABILITY_SCORE_MIN,
    AC_MAX,
    AC_MIN,
    CHARACTER_BIOGRAPHY_MAX_LENGTH,
    CHARACTER_CLASS_MAX_LENGTH,
    CHARACTER_LEVEL_MAX,
    CHARACTER_LEVEL_MIN,
    CHARACTER_NAME_MAX_LENGTH,
    CHARACTER_PORTRAIT_URL_MAX_LENGTH,
    CHARACTER_RACE_MAX_LENGTH,
    HP_MAX,
    HP_MIN,
    PROFICIENCY_BONUS_MAX,
    PROFICIENCY_BONUS_MIN,
    SPEED_MAX,
    SPEED_MIN,
} from '../constants/characters.js';

/**
 * Shared ability scores schema
 */
const abilityScoresSchema = z.object({
  strength: z.number().int().min(ABILITY_SCORE_MIN).max(ABILITY_SCORE_MAX),
  dexterity: z.number().int().min(ABILITY_SCORE_MIN).max(ABILITY_SCORE_MAX),
  constitution: z.number().int().min(ABILITY_SCORE_MIN).max(ABILITY_SCORE_MAX),
  intelligence: z.number().int().min(ABILITY_SCORE_MIN).max(ABILITY_SCORE_MAX),
  wisdom: z.number().int().min(ABILITY_SCORE_MIN).max(ABILITY_SCORE_MAX),
  charisma: z.number().int().min(ABILITY_SCORE_MIN).max(ABILITY_SCORE_MAX),
});

/**
 * Schema for creating a new character
 */
export const characterCreatePayloadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Character name is required')
    .max(CHARACTER_NAME_MAX_LENGTH, `Name must be ${CHARACTER_NAME_MAX_LENGTH} characters or fewer`),
  race: z
    .string()
    .trim()
    .min(1, 'Race is required')
    .max(CHARACTER_RACE_MAX_LENGTH, `Race must be ${CHARACTER_RACE_MAX_LENGTH} characters or fewer`),
  class: z
    .string()
    .trim()
    .min(1, 'Class is required')
    .max(CHARACTER_CLASS_MAX_LENGTH, `Class must be ${CHARACTER_CLASS_MAX_LENGTH} characters or fewer`),
  level: z.number().int().min(CHARACTER_LEVEL_MIN).max(CHARACTER_LEVEL_MAX).optional().default(1),
  abilityScores: abilityScoresSchema,
  hp: z.number().int().min(HP_MIN).max(HP_MAX),
  maxHp: z.number().int().min(1).max(HP_MAX),
  ac: z.number().int().min(AC_MIN).max(AC_MAX).optional().default(10),
  proficiencyBonus: z
    .number()
    .int()
    .min(PROFICIENCY_BONUS_MIN)
    .max(PROFICIENCY_BONUS_MAX)
    .optional()
    .default(2),
  speed: z.number().int().min(SPEED_MIN).max(SPEED_MAX).optional().default(30),
  portraitUrl: z.string().url().max(CHARACTER_PORTRAIT_URL_MAX_LENGTH)
    .refine((url) => /^https?:\/\//.test(url), { message: 'URL must use http or https' })
    .optional(),
  biography: z
    .string()
    .trim()
    .max(CHARACTER_BIOGRAPHY_MAX_LENGTH, `Biography must be ${CHARACTER_BIOGRAPHY_MAX_LENGTH} characters or fewer`)
    .optional(),
}).refine(
  (data) => data.hp <= data.maxHp,
  { message: 'HP cannot exceed max HP', path: ['hp'] },
);

/**
 * Schema for updating a character — at least one field must be provided
 */
export const characterUpdatePayloadSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Character name is required')
      .max(CHARACTER_NAME_MAX_LENGTH, `Name must be ${CHARACTER_NAME_MAX_LENGTH} characters or fewer`)
      .optional(),
    race: z
      .string()
      .trim()
      .min(1, 'Race is required')
      .max(CHARACTER_RACE_MAX_LENGTH, `Race must be ${CHARACTER_RACE_MAX_LENGTH} characters or fewer`)
      .optional(),
    class: z
      .string()
      .trim()
      .min(1, 'Class is required')
      .max(CHARACTER_CLASS_MAX_LENGTH, `Class must be ${CHARACTER_CLASS_MAX_LENGTH} characters or fewer`)
      .optional(),
    level: z.number().int().min(CHARACTER_LEVEL_MIN).max(CHARACTER_LEVEL_MAX).optional(),
    abilityScores: abilityScoresSchema.optional(),
    hp: z.number().int().min(HP_MIN).max(HP_MAX).optional(),
    maxHp: z.number().int().min(1).max(HP_MAX).optional(),
    ac: z.number().int().min(AC_MIN).max(AC_MAX).optional(),
    proficiencyBonus: z
      .number()
      .int()
      .min(PROFICIENCY_BONUS_MIN)
      .max(PROFICIENCY_BONUS_MAX)
      .optional(),
    speed: z.number().int().min(SPEED_MIN).max(SPEED_MAX).optional(),
    portraitUrl: z.string().url().max(CHARACTER_PORTRAIT_URL_MAX_LENGTH)
      .refine((url) => /^https?:\/\//.test(url), { message: 'URL must use http or https' })
      .nullable().optional(),
    biography: z
      .string()
      .trim()
      .max(CHARACTER_BIOGRAPHY_MAX_LENGTH, `Biography must be ${CHARACTER_BIOGRAPHY_MAX_LENGTH} characters or fewer`)
      .nullable()
      .optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided' },
  );

/**
 * Schema for quick HP update
 */
export const characterHpUpdatePayloadSchema = z.object({
  hp: z.number().int().min(HP_MIN).max(HP_MAX),
});

export type CharacterCreateInput = z.infer<typeof characterCreatePayloadSchema>;
export type CharacterUpdateInput = z.infer<typeof characterUpdatePayloadSchema>;
export type CharacterHpUpdateInput = z.infer<typeof characterHpUpdatePayloadSchema>;
