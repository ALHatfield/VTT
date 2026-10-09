import { z } from 'zod';

import {
    DEFAULT_JOURNAL_VISIBILITY,
    JOURNAL_CONTENT_MAX_LENGTH,
    JOURNAL_TITLE_MAX_LENGTH,
    JOURNAL_VISIBILITIES,
} from '../constants/story.js';

const journalTitleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(JOURNAL_TITLE_MAX_LENGTH, `Title must be ${JOURNAL_TITLE_MAX_LENGTH} characters or fewer`);

const journalContentSchema = z
  .string()
  .max(JOURNAL_CONTENT_MAX_LENGTH, `Content must be ${JOURNAL_CONTENT_MAX_LENGTH} characters or fewer`);

const journalVisibilitySchema = z.enum(JOURNAL_VISIBILITIES);

/**
 * Schema for creating a journal entry
 */
export const journalEntryCreatePayloadSchema = z.object({
  title: journalTitleSchema,
  content: journalContentSchema,
  visibility: journalVisibilitySchema.optional().default(DEFAULT_JOURNAL_VISIBILITY),
});

/**
 * Schema for updating a journal entry — at least one field must be provided
 */
export const journalEntryUpdatePayloadSchema = z
  .object({
    title: journalTitleSchema.optional(),
    content: journalContentSchema.optional(),
    visibility: journalVisibilitySchema.optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided' },
  );

export type JournalEntryCreateInput = z.infer<typeof journalEntryCreatePayloadSchema>;
export type JournalEntryUpdateInput = z.infer<typeof journalEntryUpdatePayloadSchema>;
