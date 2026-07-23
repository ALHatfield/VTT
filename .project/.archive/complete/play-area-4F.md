# Phase Complete: play-area 4F — Fog of War

**Completed:** 2026-06-01
**Feature:** `play-area`
**Phase:** 4F

---

## Deliverables

**New — Server**
- `server/src/features/play-area/fog.routes.ts` — REST routes for fog region CRUD (DM-only create/delete, player-safe read)
- `server/src/features/play-area/fog.service.ts` — FogService with region persistence, scene-scoped queries, role-gated delivery
- `server/src/features/play-area/fog.routes.test.ts` — Integration tests for fog routes

**New — Database**
- `server/prisma/migrations/20260601013628_add_fog_region_model/migration.sql` — `fog_regions` table with `id`, `campaign_id`, `scene_id`, `created_by_user_id`, `vertices` (JSONB), timestamps; cascade deletes on campaign and scene

## Decisions

- **Polygon-based fog regions** — DM draws polygons on `ForegroundLayer`; vertices stored as JSONB per region. Simple and sufficient for MVP.
- **Non-persisted player visibility** — Fog regions are server-authoritative; players receive only revealed regions for their scene via the fog routes.
- **DM-only write access** — Only the DM role can create or delete fog regions. Players and Observers receive read-only delivery.
- **Real-time reveal/hide** — Socket.IO broadcasts fog changes to the room on create/delete so player views update without reload.
- **Token vision deferred** — Token-based automatic vision reveals (circle around each token) are Phase 4F.1, not 4F. MVP fog is manual DM tooling only.

## Next Phase

**4F.1 — Token Vision Reveals** (depends on 4F + 4G)
