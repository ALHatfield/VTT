# Archived Phase 4J: Measure Tool & Player Color

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-08-31

---

## Phase 4J: Measure Tool & Player Color

**Dependencies:** Phase 4F.3

### Overview

Adds line measurement with distance display and real-time broadcast. Introduces player color (campaign-scoped) as a prerequisite for measure and future drawing tools.

### Tasks

**Player color**

- [x] Add `color` column to `CampaignPlayer` Prisma model (nullable `String`, default assigned on join)
- [x] Migration: add column with default null; backfill existing rows with palette-based assignment
- [x] Define color palette constant in `shared/constants/campaigns.ts` — 8-color preset cycling by join order
- [x] Add `color` field to campaign member API responses
- [x] Shared types: add `color` to `CampaignMember` type

**Measure tool mode**

- [x] Add `'measure'` to tool mode union type in `useToolMode`
- [x] Add Measure tool icon to `CanvasToolbar` — visible to DM and Player (not Observer)
- [x] Click start point, drag to end point — render measurement line as PixiJS `Graphics` overlay on `PlaygroundLayer`
- [x] Display distance label (in grid units) at midpoint of line, using scene `cellSize` for calculation
- [x] Snap-to-grid-center by default: start and end points snap to nearest grid cell center
- [x] Line color matches player's campaign color

**Broadcast**

- [x] Add broadcast toggle in measure tool panel (show to all / private)
- [x] Socket event: `play-area:measure:broadcast` — client sends `{ startX, startY, endX, endY, color }` while dragging
- [x] Server handler: relay to campaign room (DM always sees all measurements regardless of toggle)
- [x] Socket event: `play-area:measure:clear` — sent on mouseup or tool switch to remove line
- [x] Shared types: `MeasureBroadcastPayload`, `MeasureClearPayload` in `shared/types/play-area.ts`

**Tests**

- [x] Distance calculation correct for horizontal, vertical, and diagonal lines
- [x] Snap-to-center places endpoints at grid cell centers
- [x] Measurement line renders and clears correctly
- [x] Broadcast relays to room; private mode hides from non-DM players
- [x] Player color assigned on campaign join and returned in API responses

### Decisions

- Player color is campaign-scoped (stored on `CampaignPlayer`, not `User`) — a player can be red in one campaign and blue in another
- Measurement uses simple Euclidean distance for MVP; configurable diagonal styles (D&D 5E, Pathfinder) deferred
- Area-of-effect shapes (circle, cone, square templates) deferred to a post-4J phase
- Waypoints (multi-segment measurement paths) deferred
- Server injects authoritative color from `socket.data.playerColor` (set at room-join) — client-supplied color is discarded to prevent impersonation
- `MeasureClearPayload` carries `isPrivate` so the server routes clears to the same audience as the original broadcast
- `emitMeasureBroadcast`/`emitMeasureClear` callbacks exposed from `usePlayAreaSocket` rather than raw `socketRef` — keeps socket access centralized

---


