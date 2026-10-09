/**
 * Story constants
 */

export const JOURNAL_TITLE_MAX_LENGTH = 200;
export const JOURNAL_CONTENT_MAX_LENGTH = 20000;

export const JOURNAL_VISIBILITIES = ['dm', 'party'] as const;
export const DEFAULT_JOURNAL_VISIBILITY = 'dm';

// Client → Server events use present tense; Server → Client use past tense
export const STORY_EVENTS = {
  // Server → Client
  JOURNAL_CREATED: 'story:journal:created',
  JOURNAL_UPDATED: 'story:journal:updated',
  JOURNAL_DELETED: 'story:journal:deleted',
  HANDOUT_SHARED: 'story:handout:shared',
  HANDOUT_REVOKED: 'story:handout:revoked',
  QUEST_UPDATED: 'story:quest:updated',
  QUEST_DELETED: 'story:quest:deleted',
  ERROR: 'story:error',
} as const;

export type StoryEvent = (typeof STORY_EVENTS)[keyof typeof STORY_EVENTS];
