---
description: "Campaign feature — CRUD, role management, and campaign workspace patterns."
applyTo: "**/features/campaigns/**"
---
# Feature: campaigns

> For current phase status and tasks, see `.project/features/campaigns.md`

## Overview
A campaign is a self-contained workspace for a TTRPG game. The user who creates a campaign is the DM. Campaigns store maps, tokens, character data, chat history, and DM notes. State persists between sessions.

## Role System
- **DM**: Full control — edit/delete campaign, invite/remove members, manage all tokens, access editor, run encounters
- **Player**: Access play area, control their own token and character sheet, participate in chat
- **Observer**: Read-only access to the play area — cannot interact with anything

Roles are stored in `campaign_players` join table with a `role` enum column.

## Campaign CRUD
- `POST /api/campaigns` — create (authenticated user becomes DM)
- `GET /api/campaigns` — list campaigns the user belongs to
- `GET /api/campaigns/:id` — detail (members only)
- `PUT /api/campaigns/:id` — update (DM only)
- `DELETE /api/campaigns/:id` — delete (DM only, cascades all related data)

## Member Management
- `POST /api/campaigns/:id/invite` — DM invites by email, assigns role (player or observer)
- `DELETE /api/campaigns/:id/members/:userId` — DM removes a member
- `POST /api/campaigns/:id/leave` — member leaves voluntarily
- Invites create a `campaign_players` record; invited user sees campaign on next login

## Data Isolation
- All campaign data (maps, tokens, messages, assets) is scoped by `campaignId` foreign key
- API queries always filter by `campaignId` — never return data from other campaigns
- DM's secret notes and prepared content are flagged `dmOnly: true` and filtered from Player/Observer responses

## Prior Art (Project_Pathfinder)
- CampaignService handles CRUD with ownership validation
- `campaign_players` table with `role` enum (dm, player, observer)
- Email-based player invites
- Editor security via cryptographic tokens (1-hour expiry)
- 8+ REST endpoints for campaigns and player management

## Integration Points
- **Auth**: Campaign creation requires authenticated session; role checks use `requireRole` middleware
- **Play Area**: Launching a campaign loads the play area with the campaign's active map
- **Editor**: DM accesses the campaign editor to build maps and manage assets
- **Characters**: Character sheets are scoped to a campaign and linked to player tokens
