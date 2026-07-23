import { z } from 'zod';

/**
 * Login payload validator
 */
export const loginPayloadSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .toLowerCase(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
});

/**
 * Type inference from schema
 */
export type LoginPayloadInput = z.infer<typeof loginPayloadSchema>;
