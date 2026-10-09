import { z } from 'zod';

import { CAMPAIGN_DESCRIPTION_MAX_LENGTH, CAMPAIGN_NAME_MAX_LENGTH } from '../constants/campaigns.js';
import { DEFAULT_GAME_SYSTEM, GAME_SYSTEM_IDS } from '../constants/game-systems.js';

/**
 * Schema for creating a new campaign
 */
export const campaignCreatePayloadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Campaign name is required')
    .max(CAMPAIGN_NAME_MAX_LENGTH, `Name must be ${CAMPAIGN_NAME_MAX_LENGTH} characters or fewer`),
  description: z
    .string()
    .trim()
    .max(CAMPAIGN_DESCRIPTION_MAX_LENGTH, `Description must be ${CAMPAIGN_DESCRIPTION_MAX_LENGTH} characters or fewer`)
    .optional(),
  gameSystem: z
    .enum(GAME_SYSTEM_IDS, {
      errorMap: () => ({ message: 'Game system must be dnd5e or pf2e' }),
    })
    .default(DEFAULT_GAME_SYSTEM),
});

/**
 * Schema for updating an existing campaign — at least one field must be provided
 */
export const campaignUpdatePayloadSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Campaign name is required')
      .max(CAMPAIGN_NAME_MAX_LENGTH, `Name must be ${CAMPAIGN_NAME_MAX_LENGTH} characters or fewer`)
      .optional(),
    description: z
      .string()
      .trim()
      .max(CAMPAIGN_DESCRIPTION_MAX_LENGTH, `Description must be ${CAMPAIGN_DESCRIPTION_MAX_LENGTH} characters or fewer`)
      .nullable()
      .optional(),
    // The game system is immutable after creation — reject any attempt to change it
    gameSystem: z.undefined({
      invalid_type_error: 'Game system cannot be changed after creation',
    }),
  })
  .refine(
    (data) => data.name !== undefined || data.description !== undefined,
    { message: 'At least one field must be provided' },
  );

export type CampaignCreateInput = z.infer<typeof campaignCreatePayloadSchema>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdatePayloadSchema>;

/**
 * Schema for inviting a user to a campaign by email
 */
export const campaignInvitePayloadSchema = z.object({
  email: z.string().email('A valid email address is required'),
  role: z.enum(['player', 'observer'], {
    errorMap: () => ({ message: 'Role must be player or observer' }),
  }),
});

export type CampaignInviteInput = z.infer<typeof campaignInvitePayloadSchema>;
