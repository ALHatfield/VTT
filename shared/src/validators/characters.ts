import { z } from 'zod';

import {
    ABILITY_SCORE_MAX,
    ABILITY_SCORE_MIN,
    AC_MAX,
    AC_MIN,
    ATTACK_NAME_MAX_LENGTH,
    CHARACTER_BIOGRAPHY_MAX_LENGTH,
    CHARACTER_CLASS_MAX_LENGTH,
    CHARACTER_LEVEL_MAX,
    CHARACTER_LEVEL_MIN,
    CHARACTER_MAX_ATTACKS,
    CHARACTER_MAX_SPELLS,
    CHARACTER_NAME_MAX_LENGTH,
    CHARACTER_PORTRAIT_URL_MAX_LENGTH,
    CHARACTER_RACE_MAX_LENGTH,
    DAMAGE_DICE_PATTERN,
    HP_MAX,
    HP_MIN,
    PROFICIENCY_BONUS_MAX,
    PROFICIENCY_BONUS_MIN,
    SKILL_NAMES,
    SPEED_MAX,
    SPEED_MIN,
    SPELL_LEVEL_MAX,
    SPELL_LEVEL_MIN,
    SPELL_NAME_MAX_LENGTH,
    SPELL_SLOT_LEVEL_MIN,
    SPELL_SLOT_MAX_PER_LEVEL,
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
 * Portrait URL: absolute http(s) URL or a site-relative path (built-in images).
 * Protocol-relative URLs (//host/...) are rejected — they resolve off-site.
 */
const portraitUrlSchema = z
  .string()
  .max(CHARACTER_PORTRAIT_URL_MAX_LENGTH)
  .refine(
    (url) => /^https?:\/\//.test(url) || (url.startsWith('/') && !url.startsWith('//')),
    { message: 'URL must use http(s) or be a site-relative path' },
  );

/**
 * Skill proficiencies: unique skill names from the 5e list (Phase 6C)
 */
const skillProficienciesSchema = z
  .array(z.enum(SKILL_NAMES))
  .max(SKILL_NAMES.length)
  .refine((skills) => new Set(skills).size === skills.length, {
    message: 'Skill proficiencies must be unique',
  });

/**
 * A weapon/attack entry (Phase 6C)
 */
const characterAttackSchema = z.object({
  id: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, 'Attack name is required')
    .max(ATTACK_NAME_MAX_LENGTH, `Attack name must be ${ATTACK_NAME_MAX_LENGTH} characters or fewer`),
  ability: z.enum([
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
  ]),
  proficient: z.boolean(),
  damageDice: z
    .string()
    .trim()
    .regex(DAMAGE_DICE_PATTERN, 'Damage dice must look like "1d8" or "2d6"'),
});

const attacksSchema = z
  .array(characterAttackSchema)
  .max(CHARACTER_MAX_ATTACKS)
  .refine((attacks) => new Set(attacks.map((a) => a.id)).size === attacks.length, {
    message: 'Attack ids must be unique',
  });

/**
 * A spell entry (Phase 6D)
 */
const characterSpellSchema = z.object({
  id: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, 'Spell name is required')
    .max(SPELL_NAME_MAX_LENGTH, `Spell name must be ${SPELL_NAME_MAX_LENGTH} characters or fewer`),
  level: z.number().int().min(SPELL_LEVEL_MIN).max(SPELL_LEVEL_MAX),
  prepared: z.boolean(),
});

const spellsSchema = z
  .array(characterSpellSchema)
  .max(CHARACTER_MAX_SPELLS)
  .refine((spells) => new Set(spells.map((s) => s.id)).size === spells.length, {
    message: 'Spell ids must be unique',
  });

/**
 * Spell slot tracking for one level: used can never exceed max (Phase 6D)
 */
const characterSpellSlotSchema = z
  .object({
    level: z.number().int().min(SPELL_SLOT_LEVEL_MIN).max(SPELL_LEVEL_MAX),
    max: z.number().int().min(0).max(SPELL_SLOT_MAX_PER_LEVEL),
    used: z.number().int().min(0).max(SPELL_SLOT_MAX_PER_LEVEL),
  })
  .refine((slot) => slot.used <= slot.max, {
    message: 'Used slots cannot exceed max slots',
    path: ['used'],
  });

const spellSlotsSchema = z
  .array(characterSpellSlotSchema)
  .max(SPELL_LEVEL_MAX)
  .refine((slots) => new Set(slots.map((s) => s.level)).size === slots.length, {
    message: 'Spell slot levels must be unique',
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
  skillProficiencies: skillProficienciesSchema.optional().default([]),
  attacks: attacksSchema.optional().default([]),
  spells: spellsSchema.optional().default([]),
  spellSlots: spellSlotsSchema.optional().default([]),
  portraitUrl: portraitUrlSchema.optional(),
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
    skillProficiencies: skillProficienciesSchema.optional(),
    attacks: attacksSchema.optional(),
    spells: spellsSchema.optional(),
    spellSlots: spellSlotsSchema.optional(),
    portraitUrl: portraitUrlSchema.nullable().optional(),
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

/**
 * Schema for linking a character to a token (Phase 6B)
 */
export const characterLinkPayloadSchema = z.object({
  characterId: z.string().min(1, 'characterId is required'),
  tokenId: z.string().min(1, 'tokenId is required'),
});

/**
 * Schema for assigning a character to a user (Phase 6B, DM only)
 */
export const characterAssignmentPayloadSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export type CharacterCreateInput = z.infer<typeof characterCreatePayloadSchema>;
export type CharacterUpdateInput = z.infer<typeof characterUpdatePayloadSchema>;
export type CharacterHpUpdateInput = z.infer<typeof characterHpUpdatePayloadSchema>;
export type CharacterLinkInput = z.infer<typeof characterLinkPayloadSchema>;
export type CharacterAssignmentInput = z.infer<typeof characterAssignmentPayloadSchema>;
