---
description: "Inventory feature — item catalog, party loot, equipment tracking, item transfers, merchant stores, and trading."
applyTo: "**/features/inventory/**"
---
# Feature: inventory

> For current phase status and tasks, see `.project/features/inventory.md`

## Overview
The inventory feature manages items in a campaign: a DM-curated item catalog, per-character inventories with equipment tracking, a shared party loot pool, and merchant stores attached to NPC creatures. It lets the DM award loot and run shops, players manage what their characters carry, equip, buy, and sell, and items move between characters and the party pool with a full audit trail. Everything is scoped to a campaign and validated server-side.

## Domain Model
- **Item**: a campaign-scoped catalog entry (name, description, category, weight, value, stackable flag). The catalog is the single definition of an item — inventories reference it, never copy it
- **Inventory entry**: a join between a holder (character or party pool) and an item, with `quantity` and `equipped` state. Stackable items merge into one entry per holder; non-stackable items get one entry each
- **Party loot**: a campaign-level holder with no character — the shared pool the DM awards loot into and players claim from
- **Transfer**: a server-validated move of quantity between holders (character ↔ character, character ↔ party pool). Transfers are atomic — decrement and increment happen in one transaction
- **Store**: a shop attached to exactly one `npc`-kind bestiary creature, with tracked `StoreStock` quantities, buy/sell rates, and optional per-item price overrides. Default price = catalog `value` × rate
- **Transaction**: an append-only buy/sell log entry. Purchases and sales are atomic — stock, purse (`Character.currency`), and inventory entries change in one transaction; the server is the sole authority on prices, funds, and stock
- All records carry `campaignId` and cascade-delete with the campaign

## Role-Based Access
- **DM**: Full CRUD on the item catalog; can modify any inventory and award or remove party loot; manages stores, stock, and rates; may trade on behalf of any character
- **Player**: Reads the catalog, manages their own characters' inventories (equip, drop, transfer out), claims from party loot, buys/sells at stores with characters they own
- **Observer**: Read-only view of party loot and `party`-visible inventories; never mutates
- Ownership checks resolve through the character's `userId` — a player can only mutate inventories of characters they own
- Validation happens in the service layer — never trust a client-supplied holder id without checking campaign membership

## API Endpoints
All routes are mounted under `/api/campaigns` and use `requireAuth` + `requireCampaignRole`.

- `GET|POST /api/campaigns/:id/items`, `PUT|DELETE /api/campaigns/:id/items/:itemId` — item catalog CRUD (writes DM only)
- `GET /api/campaigns/:id/characters/:characterId/inventory` — a character's inventory (owner, DM, or party-visible)
- `POST /api/campaigns/:id/characters/:characterId/inventory` — add an item to a character (DM, or owner from party loot)
- `PUT /api/campaigns/:id/inventory/:entryId` — update quantity or equipped state (owner or DM)
- `DELETE /api/campaigns/:id/inventory/:entryId` — remove an entry (owner or DM)
- `GET /api/campaigns/:id/loot` — the party loot pool
- `POST /api/campaigns/:id/transfers` — transfer quantity between holders (validated, atomic)
- `GET|POST /api/campaigns/:id/stores`, `PUT|DELETE .../stores/:storeId` and stock sub-routes — store management (writes DM only)
- `POST /api/campaigns/:id/stores/:storeId/purchase|sell` — trading (character owner or DM; Observer rejected)

## Real-time Events
- Event names live in `INVENTORY_EVENTS` (`shared/src/constants/inventory.ts`), prefixed `inventory:`
- Mutations go through REST; the route emits the past-tense broadcast after the write succeeds (`inventory:item:updated`, `inventory:entry:updated`, `inventory:transfer:completed`, `inventory:store:updated`, `inventory:transaction:completed`)
- Inventory changes broadcast to the `campaign:{campaignId}` room — item possession is table-public information
- Payloads always include `campaignId`

## Integration Points
- **Campaigns**: All inventory records are scoped by `campaignId`; role checks use `requireCampaignRole`
- **Characters**: Character inventories hang off the `Character` model (6A); equipped state surfaces on the character sheet
- **Auth**: Ownership checks resolve through the authenticated session and character ownership
- **Bestiary**: Loot tables (8E) will roll results into the party loot pool (future); merchant stores (10D) attach to `npc`-kind creatures from the creature library (8A)
