import { z } from 'zod';

import {
    DEFAULT_ITEM_CATEGORY,
    ITEM_CATEGORIES,
    ITEM_DESCRIPTION_MAX_LENGTH,
    ITEM_NAME_MAX_LENGTH,
    MAX_ITEM_QUANTITY,
} from '../constants/inventory.js';

const itemNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(ITEM_NAME_MAX_LENGTH, `Name must be ${ITEM_NAME_MAX_LENGTH} characters or fewer`);

const itemDescriptionSchema = z
  .string()
  .max(
    ITEM_DESCRIPTION_MAX_LENGTH,
    `Description must be ${ITEM_DESCRIPTION_MAX_LENGTH} characters or fewer`,
  );

const itemCategorySchema = z.enum(ITEM_CATEGORIES);

const quantitySchema = z
  .number()
  .int()
  .min(1, 'Quantity must be at least 1')
  .max(MAX_ITEM_QUANTITY, `Quantity must be ${MAX_ITEM_QUANTITY} or fewer`);

/**
 * Schema for creating a catalog item
 */
export const itemCreatePayloadSchema = z.object({
  name: itemNameSchema,
  description: itemDescriptionSchema.optional(),
  category: itemCategorySchema.optional().default(DEFAULT_ITEM_CATEGORY),
  weight: z.number().min(0).optional(),
  value: z.number().min(0).optional(),
  stackable: z.boolean().optional().default(false),
});

/**
 * Schema for updating a catalog item — at least one field must be provided
 */
export const itemUpdatePayloadSchema = z
  .object({
    name: itemNameSchema.optional(),
    description: itemDescriptionSchema.optional(),
    category: itemCategorySchema.optional(),
    weight: z.number().min(0).optional(),
    value: z.number().min(0).optional(),
    stackable: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided' },
  );

/**
 * Schema for transferring quantity between holders — holders must differ
 */
export const itemTransferPayloadSchema = z
  .object({
    itemId: z.string().min(1),
    fromCharacterId: z.string().min(1).nullable(),
    toCharacterId: z.string().min(1).nullable(),
    quantity: quantitySchema,
  })
  .refine(
    (data) => data.fromCharacterId !== data.toCharacterId,
    { message: 'Source and destination must differ' },
  );

export type ItemCreateInput = z.infer<typeof itemCreatePayloadSchema>;
export type ItemUpdateInput = z.infer<typeof itemUpdatePayloadSchema>;
export type ItemTransferInput = z.infer<typeof itemTransferPayloadSchema>;
