# Feature: Story

> **Slug:** `story`
> **Feature dirs:** `client/src/features/story/`, `server/src/features/story/`
> **Instructions:** `.github/instructions/feature-story.instructions.md`
> **Shared types:** `shared/types/story.ts`

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 7A | Chapters & Journal Entries | Not Started |
| 7B | Handouts | Not Started |
| 7C | Quest Tracker | Not Started |
| 7D | Chapter Scene Links | Not Started |

---

## Phase 7A: Chapters & Journal Entries

**Dependencies:** campaigns Phase 3A

### Tasks
- [ ] Prisma `Chapter` model (`id`, `campaignId`, `title`, `summary?`, `sortOrder`, `isCurrent`, timestamps); cascade on campaign delete; index on `(campaignId, sortOrder)`
- [ ] Shared types/validators: `Chapter`, `ChapterCreatePayload`, `ChapterUpdatePayload`, `ChapterReorderPayload`
- [ ] Chapter endpoints (DM only): `GET|POST /api/campaigns/:id/chapters`, `PUT|DELETE /api/campaigns/:id/chapters/:chapterId`, `PUT /api/campaigns/:id/chapters/order`; setting `isCurrent` clears it on every other chapter in one transaction
- [ ] Prisma `JournalEntry` model (`id`, `campaignId`, `chapterId?` (`onDelete: SetNull`), `authorId`, `title`, `content`, `visibility` enum `dm | party`, `sortOrder`, timestamps); cascade on campaign delete; index on `campaignId`
- [ ] Shared types: `JournalEntry`, `JournalEntryCreatePayload`, `JournalEntryUpdatePayload`, `JournalEntryChangedPayload`, `JournalEntryDeletedPayload`
- [ ] Shared Zod validators: `journalEntryCreatePayloadSchema`, `journalEntryUpdatePayloadSchema` (title/content length limits from constants)
- [ ] `story.service.ts`: list/get/create/update/delete with role-aware `where` filtering (`dm` entries excluded for non-DMs)
- [ ] `story.routes.ts`: journal CRUD endpoints; writes DM only; non-DM requests for `dm` entries return `404`
- [ ] Mount `storyRouter` under `/api/campaigns` in `server/src/app.ts`
- [ ] Socket broadcasts after writes: `story:journal:created|updated|deleted` — `party` entries to the campaign room, `dm` entries to DM sockets only
- [ ] Client: `useJournalEntries` and `useChapters` hooks (fetch + socket sync through a single source of truth)
- [ ] Client: `ChapterList` (DM only) — ordered list with drag-to-reorder, current-chapter marker, expandable to show the chapter's entries; unassigned entries grouped under "Unsorted"
- [ ] Client: `JournalPanel` (entry list + reader) and `JournalEditor` (DM only — title, markdown body, visibility toggle, chapter picker)
- [ ] Sanitized markdown rendering for entry content
- [ ] Add a Journal entry point in the campaign workspace / play area sidebar
- [ ] Tests: validators, chapter reorder and single-current invariant, chapter delete leaves entries unsorted, service visibility filtering, route RBAC (DM/Player/Observer), socket emission targets, sanitized render

### Decisions
- Chapters are a simple ordered list — no branching or node graph
- Chapters are DM-only (prep structure is a spoiler); players see `party` entries without chapter grouping
- Entries are DM-authored only in this phase; player notes are post-MVP
- Store raw markdown and sanitize on render — the server never stores HTML
- Hidden content returns `404` to non-DMs so its existence isn't leaked

---

## Phase 7B: Handouts

**Dependencies:** Phase 7A + play-area Phase 4C

### Tasks
- [ ] Prisma `Handout` model (`id`, `campaignId`, `journalEntryId`, optional `assetId`, `sharedById`, `createdAt`) and `HandoutRecipient` join (`handoutId`, `userId`); `allPlayers` flag for party-wide reveals
- [ ] Shared types: `Handout`, `HandoutSharePayload`, `HandoutSharedPayload`, `HandoutRevokedPayload`
- [ ] Shared Zod validator: `handoutSharePayloadSchema` (entry id, optional asset id, `allPlayers` or recipient user ids)
- [ ] Server validates that recipients are campaign members and the asset belongs to the campaign (or is built-in)
- [ ] Endpoints: share, list (recipient-filtered), revoke
- [ ] Socket: `story:handout:shared` / `story:handout:revoked` emitted only to recipient sockets (plus DM)
- [ ] Client: "Share as handout" action in `JournalEditor` with recipient picker
- [ ] Client: handout reveal popup in the play area and a persistent "Handouts" list for players
- [ ] Tests: recipient filtering, revoke removes access, cross-campaign asset rejection, socket targeting

### Decisions
- A handout references a journal entry rather than copying it — later DM edits are visible to recipients
- Revoking removes access but keeps the journal entry intact

---

## Phase 7C: Quest Tracker

**Dependencies:** Phase 7A

### Tasks
- [ ] Prisma `Quest` model (`id`, `campaignId`, `chapterId?` (`onDelete: SetNull`), `title`, `description`, `status` enum `hidden | active | completed | failed`, `objectives Json`, `sortOrder`, timestamps)
- [ ] Shared types: `Quest`, `QuestObjective`, `QuestStatus`, `QuestCreatePayload`, `QuestUpdatePayload`, `QuestUpdatedPayload`
- [ ] Shared Zod validators for quest create/update (objective list length and text limits)
- [ ] Endpoints: quest CRUD; writes DM only; `hidden` quests filtered out for non-DMs
- [ ] Socket: `story:quest:updated` / `story:quest:deleted`; transitions out of `hidden` broadcast to the room, `hidden` quests to DM sockets only
- [ ] Client: `QuestLog` panel (grouped by status, objective checkboxes for DM)
- [ ] Optional: post a chat system message when a quest is completed or failed
- [ ] Tests: status filtering, objective validation, reorder, socket targeting on hide/reveal

### Decisions
- Objectives are stored as validated JSON on the quest — they have no independent lifecycle
- Revealing a quest is just a status change from `hidden`; no separate reveal endpoint

---

## Phase 7D: Chapter Scene Links

**Dependencies:** Phase 7A + play-area Phase 4L

### Tasks
- [ ] Prisma `ChapterScene` join (`id`, `chapterId`, `sceneId`, `campaignId`, `sortOrder`); unique `(chapterId, sceneId)`; cascade on chapter or scene delete
- [ ] Shared types/validators: `ChapterScene`, `ChapterSceneLinkPayload`, `ChapterSceneReorderPayload`
- [ ] Endpoints (DM only): link, unlink, and reorder scenes within a chapter; reject chapters or scenes from other campaigns
- [ ] Include linked scene summaries (name, thumbnail, isActive) in the DM chapter list response
- [ ] `ChapterList`: show linked scene thumbnails per chapter with a "Link scene" picker (uses the editor 5H scene list)
- [ ] Scene card actions: "Edit" opens the scene in the editor; "Go live" emits `play-area:scene:activate` with a confirmation
- [ ] Going live from a chapter also marks that chapter as current
- [ ] Show the chapter's quests alongside its scenes and entries
- [ ] Tests: link/unlink/reorder, cross-campaign rejection, scene delete removes links, go-live sets current chapter, RBAC

### Decisions
- A scene can appear in more than one chapter (recurring locations like a town hub)
- Scene activation reuses the play-area 4L socket intent — story never activates scenes on its own

---

## Cross-Feature Dependencies

| Depends On | Why |
|-----------|-----|
| campaigns Phase 3A | Story records are scoped to campaigns and use campaign role checks |
| play-area Phase 4C | Handout reveals use the campaign socket room infrastructure |
| play-area Phase 4L | Chapters launch scenes through the scene activation intent |

| Depended On By | Why |
|---------------|-----|
| campaigns Phase 3D | DM Campaign Hub hosts the Story tab |

---

## Architectural Decisions (from Project_Pathfinder)

Project_Pathfinder had no journal, handout, or quest system — this feature is new.

**What we're adopting from other features:**
- REST for mutations with post-write socket broadcasts (same pattern as walls, lights, and tokens)
- Role filtering in the service query, matching the `dmOnly` data isolation rule from campaigns
- Single source of truth for socket-synced client state (see play-area stale-state lesson)

**What we're doing differently:**
- DM-only content is emitted to DM sockets only, not the shared campaign room
