---
description: "Bestiary feature — system-aware monster and NPC stat blocks, creature tokens, stat block rolling, and loot tables for the DM."
applyTo: "**/features/bestiary/**"
---
# Feature: bestiary

> For current phase status and tasks, see `.project/features/bestiary.md`

## Overview
The bestiary is the DM's library of creature stat blocks for a campaign. It stores monsters and NPCs in the campaign's game system (D&D 5e or Pathfinder 2e), places them on the canvas as tokens with their own HP, and lets the DM roll attacks, saves, and initiative straight from the stat block. Stat blocks are DM-only — players only see what the token shows.

## Data Model
- **Creature**: campaign-scoped stat block template — `kind` (`monster | npc`), `name`, `size`, `creatureType`, `ac`, `maxHp`, `hpFormula`, `speed`, `abilityScores`, `portraitUrl`, `notes`
- System-specific data (5e CR/XP, actions, legendary actions; PF2e level, traits, Fort/Ref/Will, action costs) lives in one validated `systemData` JSON column; actions share one `CreatureAction` shape across systems
- **Creature instance**: a token placed from a creature (`Token.creatureId`) using the existing `Token.hp`/`maxHp`/`ac` columns — editing the template never changes tokens already in play
- **Loot table**: weighted entries (item, quantity formula, currency, optional sub-table) rolled server-side; creatures may link one table. Results are DM-private until revealed or awarded to a character's inventory
- All records carry `campaignId` and cascade-delete with the campaign

## Game System Awareness
- The campaign's `gameSystem` decides which `systemData` shape is valid — mismatches return `422`
- Modifiers, save DCs, and attack bonuses are derived at read time via `getGameSystemRules()` — never stored
- The stat block UI renders a shared header (name, size, type, AC, HP, speed, ability scores) plus a system-specific section component

## Role-Based Access
- **DM**: Full CRUD on creatures; sees full stat blocks; rolls from stat blocks
- **Player / Observer**: No access to the bestiary API — every route is DM only
- Players see creature tokens like any other monster/NPC token: name and health state only, never AC, HP numbers, or stat blocks
- Return `404` (not `403`) for creature lookups outside the caller's campaign

## API Endpoints
All routes are mounted under `/api/campaigns` and use `requireAuth` + `requireCampaignRole('dm')`.

- `GET /api/campaigns/:id/creatures` — list creatures (supports `?search=` by name/type)
- `POST /api/campaigns/:id/creatures` — create creature
- `GET /api/campaigns/:id/creatures/:creatureId` — stat block detail
- `PUT /api/campaigns/:id/creatures/:creatureId` — update creature
- `DELETE /api/campaigns/:id/creatures/:creatureId` — delete creature (`204`; placed tokens keep their last values and drop the link)
- `POST /api/campaigns/:id/creatures/:creatureId/tokens` — place a creature token on a scene
- `POST /api/campaigns/:id/creatures/import` / `GET /api/campaigns/:id/creatures/export` — JSON import/export
- `GET|POST /api/campaigns/:id/loot-tables`, `PUT|DELETE /api/campaigns/:id/loot-tables/:tableId`, `POST /api/campaigns/:id/loot-tables/:tableId/roll` — loot tables

## Real-time Events
- Event names live in `BESTIARY_EVENTS` (`shared/src/constants/bestiary.ts`), prefixed `bestiary:`
- Library mutations go through REST; broadcasts go to DM sockets only, never the shared `campaign:{campaignId}` room
- Creature tokens reuse the existing play-area token events (`play-area:token:created|updated`) — don't add parallel token events
- Stat block rolls go through the existing dice/chat pipeline; DM rolls can be hidden from players

## Content & Licensing
- Ship no copyrighted monster content — creatures are user-entered or imported from ORC/OGL-licensed SRD material the DM supplies
- Imported JSON is validated with the same Zod schemas as manual entry; reject unknown fields

## Post-MVP Roadmap
- Shared bestiary across a user's campaigns (user-owned creatures, like built-in assets)
- Encounter builder with difficulty calculator
- Automated attack resolution against target AC and damage application to tokens
- Creature spellcasting with slot/focus tracking

## Integration Points
- **Campaigns**: Creatures are scoped by `campaignId`; stat block shape and math come from the campaign's game system (Phase 3C)
- **Play Area**: Creature tokens use the token system, NPC placement tool, dice roller, and initiative tracker
- **Editor**: Creature portraits can come from the campaign asset library
- **Characters**: Shares ability score types and game system rules with character sheets
