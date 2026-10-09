/**
 * Inventory constants
 */

export const ITEM_NAME_MAX_LENGTH = 100;
export const ITEM_DESCRIPTION_MAX_LENGTH = 2000;
export const MAX_ITEM_QUANTITY = 9999;

export const ITEM_CATEGORIES = ['weapon', 'armor', 'gear', 'consumable', 'treasure', 'other'] as const;
export const DEFAULT_ITEM_CATEGORY = 'other';

// Client → Server events use present tense; Server → Client use past tense
export const INVENTORY_EVENTS = {
  // Server → Client
  ITEM_CREATED: 'inventory:item:created',
  ITEM_UPDATED: 'inventory:item:updated',
  ITEM_DELETED: 'inventory:item:deleted',
  ENTRY_CREATED: 'inventory:entry:created',
  ENTRY_UPDATED: 'inventory:entry:updated',
  ENTRY_DELETED: 'inventory:entry:deleted',
  TRANSFER_COMPLETED: 'inventory:transfer:completed',
  ERROR: 'inventory:error',
} as const;

export type InventoryEvent = (typeof INVENTORY_EVENTS)[keyof typeof INVENTORY_EVENTS];
