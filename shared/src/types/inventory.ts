/**
 * Inventory Types
 * Shared between client and server
 */

/**
 * Catalog item category
 */
export type ItemCategory = 'weapon' | 'armor' | 'gear' | 'consumable' | 'treasure' | 'other';

/**
 * A campaign-scoped item catalog entry
 */
export interface Item {
  id: string;
  campaignId: string;
  name: string;
  description: string | null;
  category: ItemCategory;
  weight: number | null;
  value: number | null;
  stackable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payload for creating a catalog item
 */
export interface ItemCreatePayload {
  name: string;
  description?: string;
  category?: ItemCategory;
  weight?: number;
  value?: number;
  stackable?: boolean;
}

/**
 * Payload for updating a catalog item — at least one field required
 */
export interface ItemUpdatePayload {
  name?: string;
  description?: string;
  category?: ItemCategory;
  weight?: number;
  value?: number;
  stackable?: boolean;
}

/**
 * An item held by a character, or by the party loot pool when `characterId` is null
 */
export interface InventoryEntry {
  id: string;
  campaignId: string;
  itemId: string;
  characterId: string | null;
  quantity: number;
  equipped: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payload for adding an item to a holder
 */
export interface InventoryEntryCreatePayload {
  itemId: string;
  characterId?: string;
  quantity?: number;
}

/**
 * Payload for updating an inventory entry — at least one field required
 */
export interface InventoryEntryUpdatePayload {
  quantity?: number;
  equipped?: boolean;
}

/**
 * Payload for transferring quantity between holders (`null` holder = party loot)
 */
export interface ItemTransferPayload {
  itemId: string;
  fromCharacterId: string | null;
  toCharacterId: string | null;
  quantity: number;
}

/** Server → Client: a catalog item was created or updated */
export interface ItemChangedPayload {
  campaignId: string;
  item: Item;
}

/** Server → Client: a catalog item was deleted */
export interface ItemDeletedPayload {
  campaignId: string;
  itemId: string;
}

/** Server → Client: an inventory entry was created or updated */
export interface InventoryEntryChangedPayload {
  campaignId: string;
  entry: InventoryEntry;
}

/** Server → Client: an inventory entry was deleted */
export interface InventoryEntryDeletedPayload {
  campaignId: string;
  entryId: string;
}

/** Server → Client: a transfer completed — includes both holders' updated entries */
export interface ItemTransferCompletedPayload {
  campaignId: string;
  transfer: ItemTransferPayload;
  entries: InventoryEntry[];
}

/** Server → Client: structured inventory error */
export interface InventoryErrorPayload {
  code: string;
  message: string;
}
