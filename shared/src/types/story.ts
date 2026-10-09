/**
 * Story Types
 * Shared between client and server
 */

/**
 * Who can read a journal entry — `dm` is private, `party` is visible to all members
 */
export type JournalVisibility = 'dm' | 'party';

/**
 * A DM-authored journal entry (markdown content)
 */
export interface JournalEntry {
  id: string;
  campaignId: string;
  authorId: string;
  title: string;
  content: string;
  visibility: JournalVisibility;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payload for creating a journal entry
 */
export interface JournalEntryCreatePayload {
  title: string;
  content: string;
  visibility?: JournalVisibility;
}

/**
 * Payload for updating a journal entry — at least one field required
 */
export interface JournalEntryUpdatePayload {
  title?: string;
  content?: string;
  visibility?: JournalVisibility;
}

/** Server → Client: a journal entry was created or updated */
export interface JournalEntryChangedPayload {
  campaignId: string;
  entry: JournalEntry;
}

/** Server → Client: a journal entry was deleted */
export interface JournalEntryDeletedPayload {
  campaignId: string;
  entryId: string;
}

/** Server → Client: structured story error */
export interface StoryErrorPayload {
  code: string;
  message: string;
}
