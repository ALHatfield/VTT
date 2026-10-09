---
description: "Story feature — DM chapters, journal entries, player handouts, quest tracking, and chapter-scene links scoped to a campaign."
applyTo: "**/features/story/**"
---
# Feature: story

> For current phase status and tasks, see `.project/features/story.md`

## Overview
The story feature holds a campaign's narrative content: the DM's journal entries, handouts the DM reveals to players, and the party's quest log. It gives the DM a place to prepare lore and session notes, and gives players a persistent record of what they have learned. Everything is scoped to a campaign and filtered by role on the server.

## Domain Model
- **Chapter**: DM-only, simple ordered list (no branching) that structures the campaign; one chapter is marked current. Chapters group journal entries, quests, and linked scenes
- **Chapter scene link**: ordered link from a chapter to a scene; a scene may appear in multiple chapters. "Go live" reuses the play-area `play-area:scene:activate` intent
- **Journal entry**: DM-authored markdown document (title, content, visibility, optional chapter). `dm` entries are private; `party` entries are readable by every campaign member
- **Handout**: a reveal of a journal entry (and optional image asset) to all players or to specific players. Recipients keep access until the DM revokes it
- **Quest**: a tracked objective with status (`hidden`, `active`, `completed`, `failed`) and an ordered list of sub-objectives. `hidden` quests are DM-only
- All records carry `campaignId` and cascade-delete with the campaign

## Role-Based Access
- **DM**: Full CRUD on journal entries, handouts, and quests in their campaign
- **Player**: Read `party` journal entries, handouts addressed to them, and non-hidden quests
- **Observer**: Same read access as Player for `party` entries and non-hidden quests; never receives player-targeted handouts
- Filtering happens in the service layer query (`where` clause) — never fetch everything and filter in the route
- Return `404` (not `403`) when a non-DM requests a DM-only record, so its existence isn't leaked

## API Endpoints
All routes are mounted under `/api/campaigns` and use `requireAuth` + `requireCampaignRole`.

- `GET|POST /api/campaigns/:id/chapters`, `PUT|DELETE /api/campaigns/:id/chapters/:chapterId`, `PUT /api/campaigns/:id/chapters/order` — chapter CRUD (DM only)
- `POST|DELETE /api/campaigns/:id/chapters/:chapterId/scenes`, `PUT /api/campaigns/:id/chapters/:chapterId/scenes/order` — chapter scene links (DM only)
- `GET /api/campaigns/:id/journal` — list entries visible to the caller
- `POST /api/campaigns/:id/journal` — create entry (DM only)
- `GET /api/campaigns/:id/journal/:entryId` — entry detail (visibility-filtered)
- `PUT /api/campaigns/:id/journal/:entryId` — update entry (DM only)
- `DELETE /api/campaigns/:id/journal/:entryId` — delete entry (DM only, `204`)
- `POST /api/campaigns/:id/handouts` — share an entry as a handout (DM only)
- `GET /api/campaigns/:id/handouts` — handouts addressed to the caller (DM sees all)
- `DELETE /api/campaigns/:id/handouts/:handoutId` — revoke a handout (DM only)
- `GET|POST /api/campaigns/:id/quests`, `PUT|DELETE /api/campaigns/:id/quests/:questId` — quest CRUD (writes DM only)

## Real-time Events
- Event names live in `STORY_EVENTS` (`shared/src/constants/story.ts`), prefixed `story:`
- Mutations go through REST; the route emits the past-tense broadcast after the write succeeds (`story:journal:updated`, `story:handout:shared`, `story:quest:updated`)
- DM-only content (`dm` entries, `hidden` quests) must never be emitted to the shared `campaign:{campaignId}` room — emit only to DM sockets
- Handouts are emitted only to the recipients' sockets, never the whole room
- Payloads always include `campaignId`

## Content Safety
- Journal content is stored as raw markdown and validated for length with the shared Zod schema
- Client renders markdown through a sanitizer — never pass user content to `dangerouslySetInnerHTML` unsanitized
- Links in rendered content open with `rel="noopener noreferrer"`; images are limited to campaign assets

## Post-MVP Roadmap
- Player-authored private notes
- Entry folders, tags, and full-text search
- Cross-links between entries (`[[Entry Title]]`) and links from scenes/tokens to entries
- Session recap timeline generated from chat and quest changes

## Integration Points
- **Campaigns**: All story records are scoped by `campaignId`; role checks use `requireCampaignRole`
- **Play Area**: Handout reveals and quest updates surface in the play area via the campaign socket room
- **Editor**: Handout images come from the campaign asset library
- **Auth**: Authorship (`authorId`) and handout recipients are tied to authenticated users
