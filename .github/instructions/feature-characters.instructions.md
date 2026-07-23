---
description: "Character sheets feature — stats, inventory, interactive rolling, and token integration."
applyTo: "**/features/characters/**"
---
# Feature: characters

> For current phase status and tasks, see `.project/features/characters.md`

## Overview
Character sheets are interactive digital interfaces for managing TTRPG characters. They store stats, inventory, spells, and features, and integrate with the dice roller and token system.

## Core Features
- **Stats & Modifiers**: Ability scores (STR, DEX, CON, INT, WIS, CHA) with auto-calculated modifiers
- **Skills**: Proficiency tracking with modifier auto-calculation
- **Inventory**: Items with weight, quantity, and properties — auto-calculated encumbrance
- **Spells**: Spell list with slot tracking, prepared spells, and level-based filtering
- **Features & Abilities**: Class features, racial traits, and feat descriptions
- **Biography**: Character name, race, class, level, appearance, backstory tabs

## Interactive Rolling
- Clicking an ability score, skill, or weapon attack triggers a dice roll
- Modifiers are auto-calculated from character data and added to the roll
- Roll results are sent to the campaign chat via Socket.IO
- Formula display: `d20 + 5 (DEX) = 18`
- Support for advantage/disadvantage (roll 2d20, take higher/lower)

## Character-Token Linking
- Each player's character is linked to their token on the play area canvas
- `character_tokens` join table: `characterId`, `tokenId`, `campaignId`
- Token displays character portrait, name, and current HP
- HP changes on the character sheet reflect on the token (and vice versa)
- DM can link any character to any token; players can only link their own

## Data Model
- Characters belong to a user and are scoped to a campaign
- Core fields: name, race, class, level, ability scores, HP (current/max), AC
- Extended data stored as JSON columns: inventory, spells, features
- Character portrait URL for token display

## API Endpoints
- `POST /api/campaigns/:id/characters` — create character (player or DM)
- `GET /api/campaigns/:id/characters` — list campaign characters (filtered by role)
- `GET /api/campaigns/:id/characters/:charId` — character detail
- `PUT /api/campaigns/:id/characters/:charId` — update (owner or DM)
- `PATCH /api/campaigns/:id/characters/:charId/hp` — quick HP update (used during combat)

## Prior Art (Project_Pathfinder)
- `character_tokens` table with linking API
- `CharacterLinkModal` for DM bulk character-token assignment
- `TokenCard` component displaying name, HP, AC, portrait on hover
- Backend HP update endpoint with WebSocket broadcast
- Character portrait rendering on canvas tokens
- `useCharacterLinking` hook for modal state and linking logic

## Integration Points
- **Play Area**: Character data feeds into tokens (portrait, HP, AC display)
- **Dice Roller**: Character modifiers auto-populate roll formulas
- **Initiative**: Character's initiative modifier used for combat ordering
- **Chat**: Roll results from character sheet actions appear in campaign chat
