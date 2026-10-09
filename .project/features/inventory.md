# Feature: Inventory

> **Slug:** `inventory`
> **Feature dirs:** `client/src/features/inventory/`, `server/src/features/inventory/`
> **Instructions:** `.github/instructions/feature-inventory.instructions.md`
> **Shared types:** `shared/types/inventory.ts`

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 10A | Item Catalog | Not Started |
| 10B | Character Inventory | Not Started |
| 10C | Item Transfers & Party Loot | Not Started |
| 10D | Merchant Stores | Not Started |
| 10E | Trading & Transactions | Not Started |

---

## Phase 10A: Item Catalog

**Dependencies:** campaigns Phase 3A + characters Phase 6A

### Tasks
- [ ] Prisma `Item` model (`id`, `campaignId`, `name`, `description?`, `category`, `weight?`, `value?`, `stackable`, timestamps); cascade on campaign delete; index on `campaignId`
- [ ] Shared types: `Item`, `ItemCategory`, `ItemCreatePayload`, `ItemUpdatePayload`, `ItemChangedPayload`, `ItemDeletedPayload`
- [ ] Shared Zod validators: `itemCreatePayloadSchema`, `itemUpdatePayloadSchema` (name/description length limits from constants)
- [ ] `inventory.service.ts`: item catalog list/get/create/update/delete scoped by `campaignId`
- [ ] `inventory.routes.ts`: catalog CRUD endpoints; writes DM only; reads for all campaign members
- [ ] Mount `inventoryRouter` under `/api/campaigns` in `server/src/app.ts`
- [ ] Socket broadcasts after writes: `inventory:item:created|updated|deleted` to the campaign room
- [ ] Client: `useItemCatalog` hook (fetch + socket sync through a single source of truth)
- [ ] Client: `ItemCatalog` panel (searchable list, category filter) and `ItemEditor` (DM only)
- [ ] Tests: validators, service campaign scoping, route RBAC (DM/Player/Observer), socket emission

### Decisions
- The catalog is campaign-scoped — no global item database in MVP; import/export is post-MVP
- Inventories reference catalog items by id — editing an item updates it everywhere it is held
- Deleting a catalog item cascades to inventory entries (confirmed in the UI before delete)

---

## Phase 10B: Character Inventory

**Dependencies:** Phase 10A

### Tasks
- [ ] Prisma `InventoryEntry` model (`id`, `campaignId`, `itemId`, `characterId?` (null = party loot), `quantity`, `equipped`, timestamps); cascade on campaign/item/character delete; unique `(characterId, itemId)` for stackable merge
- [ ] Shared types: `InventoryEntry`, `InventoryEntryCreatePayload`, `InventoryEntryUpdatePayload`, `InventoryEntryChangedPayload`, `InventoryEntryDeletedPayload`
- [ ] Shared Zod validators: entry create/update (quantity bounds from constants, equipped flag)
- [ ] Service: add/update/remove entries with ownership checks (player mutates only own characters' entries; DM mutates any); stackable items merge quantities
- [ ] Endpoints: character inventory list, add entry, update entry (quantity/equipped), delete entry
- [ ] Socket broadcasts: `inventory:entry:created|updated|deleted` to the campaign room
- [ ] Client: `useCharacterInventory` hook keyed by character id
- [ ] Client: `InventoryPanel` on the character sheet — item rows with quantity, equip toggle, encumbrance total (weight × quantity)
- [ ] Tests: ownership enforcement, stackable merge, quantity bounds, equip toggle, socket emission

### Decisions
- Inventory entries are normalized rows, not a JSON blob on the character — enables transfers and auditing
- Equipped state lives on the entry (per-holder), not the catalog item
- Encumbrance is computed client-side from catalog weights — no server-side carry limits in MVP

---

## Phase 10C: Item Transfers & Party Loot

**Dependencies:** Phase 10B

### Tasks
- [ ] Shared types: `ItemTransferPayload`, `ItemTransferCompletedPayload` (from/to holder, item, quantity)
- [ ] Shared Zod validator: `itemTransferPayloadSchema` (positive quantity, distinct holders)
- [ ] Service: atomic transfer in one transaction — validate source quantity, decrement source, increment/merge destination; both holders must belong to the campaign
- [ ] `POST /api/campaigns/:id/transfers` endpoint; player may transfer only from characters they own; claims from party loot allowed for any player; Observer rejected
- [ ] Party loot endpoints: `GET /api/campaigns/:id/loot`; DM awards loot via the 10B add-entry endpoint with `characterId: null`
- [ ] Socket broadcast: `inventory:transfer:completed` to the campaign room (includes both holders' updated entries)
- [ ] Client: `PartyLootPanel` (claim button per item for players, award/remove controls for DM)
- [ ] Client: transfer dialog from `InventoryPanel` (pick target character or party loot, quantity stepper)
- [ ] Optional: post a chat system message when loot is awarded or claimed
- [ ] Tests: atomicity (insufficient quantity rejected), ownership rules, cross-campaign holder rejection, Observer rejection, merge on destination, socket payload shape

### Decisions
- Transfers are a dedicated endpoint, not paired entry updates — the server guarantees atomicity
- Party loot is an inventory holder with `characterId: null`, not a separate model
- Claims are first-come-first-served; DM mediation of contested loot is a social problem, not a technical one

---

## Phase 10D: Merchant Stores

**Dependencies:** Phase 10A + bestiary Phase 8A

### Tasks
- [ ] Prisma `Store` model (`id`, `campaignId`, `creatureId` unique (`onDelete: Cascade`), `name`, `description?`, `buyRate Decimal` default 1.0, `sellRate Decimal` default 0.5, timestamps) and `StoreStock` (`id`, `storeId`, `itemId`, `quantity`, `priceOverride Json?`, `sortOrder`); cascade on store/item delete
- [ ] Shared types: `Store`, `StoreStock`, `StoreCreatePayload`, `StoreUpdatePayload`, `StoreStockPayload`, changed/deleted broadcast payloads
- [ ] Shared Zod validators: store create/update (rates bounded 0–10), stock add/update (non-negative quantity, price override shape)
- [ ] Service: store CRUD (one store per creature; 422 if the creature isn't `npc` kind); stock add/update/remove/restock
- [ ] Endpoints: store + stock CRUD, DM only; reads for all campaign members
- [ ] Socket broadcasts: `inventory:store:created|updated|deleted` and `inventory:store:stock:updated` to the campaign room
- [ ] Client: `useStore` hook keyed by creature id; `StoreEditor` (DM: pick catalog items, set quantity/price override, buy/sell rates)
- [ ] Bestiary entry point: creature card/stat block shows a "Store" badge that opens the store (link only — no bestiary logic changes)
- [ ] Tests: one-store-per-creature constraint, npc-kind enforcement, RBAC, rate/override validation, socket emission

### Decisions
- Stock quantities are tracked, not infinite — the DM restocks manually
- Default price = catalog item `value` × store rate; `priceOverride` wins when set
- Deleting the creature deletes its store; deleting a catalog item cascades to stock (consistent with 10A)

---

## Phase 10E: Trading & Transactions

**Dependencies:** Phase 10C + Phase 10D

### Tasks
- [ ] Prisma: add `currency Json` to the Character model (per-system denominations, default all-zero) via migration
- [ ] Shared constants: currency denominations per game system (5e cp/sp/ep/gp/pp; PF2e cp/sp/gp/pp) with conversion ratios — bestiary 8E reuses these
- [ ] Shared types/validators: `PurchasePayload`, `SellPayload`, `TransactionCompletedPayload`; currency math helpers (add/subtract/auto-convert within a system)
- [ ] Service: purchase — validate stock + funds, then decrement stock, debit purse, add/merge inventory entry in one transaction; sell — validate ownership, credit purse at sell rate, decrement entry, optionally add to store stock
- [ ] Prisma `Transaction` log model (`id`, `campaignId`, `storeId?`, `characterId`, `kind` buy/sell, `itemId`, `quantity`, `totalPrice Json`, timestamp) — append-only
- [ ] Endpoints: `POST .../stores/:storeId/purchase|sell`; acting player must own the character (DM may act for any); Observer rejected
- [ ] Socket broadcast: `inventory:transaction:completed` to the campaign room (updated stock, purse, and entries)
- [ ] Client: `ShopPanel` (player storefront: browse stock, prices in system denominations, buy/sell, purse display); structured insufficient-funds / out-of-stock errors surfaced inline
- [ ] Optional: post a chat system message on purchase/sale
- [ ] Tests: transaction atomicity (no partial debit), funds/stock validation, currency auto-conversion per system, RBAC, transaction log entries

### Decisions
- Server is the sole authority on funds and stock — clients never compute final prices
- Currency auto-converts within a system during payment (e.g., break 1 gp into sp); systems never mix
- No player-to-player currency trading in MVP — item transfers (10C) remain currency-free

---

## Cross-Feature Dependencies

| Depends On | Why |
|-----------|-----|
| campaigns Phase 3A | Inventory records are scoped to campaigns and use campaign role checks |
| characters Phase 6A | Inventory entries attach to characters; ownership resolves through character ownership |
| bestiary Phase 8A | Merchant stores (10D) attach to `npc`-kind creatures |

| Depended On By | Why |
|---------------|-----|
| bestiary Phase 8E | Loot tables roll results into the party loot pool; reuses 10E currency constants |

---

## Architectural Decisions (from Project_Pathfinder)

**What worked well:**
- Simple equipment shape (`{ name, quantity, equipped }`) covered most play needs
- Versioned change tracking on the character sheet made item changes auditable

**What we're changing:**
- Project_Pathfinder embedded equipment as a JSON array inside the character sheet → new build normalizes items into a catalog + entry rows, enabling transfers, party loot, and shared item definitions
- No item catalog existed — every character typed item names free-form → new build has a DM-curated campaign catalog so names, weights, and values stay consistent
- Transfers didn't exist (players edited two sheets by hand) → new build makes transfers atomic and server-validated
