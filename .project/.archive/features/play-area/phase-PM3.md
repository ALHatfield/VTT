# Archived Phase PM3: Fog of War - Line of Sight Runtime (Post-MVP)

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-09-29

---

## Phase PM3: Fog of War - Line of Sight Runtime (Post-MVP)

**Dependencies:** Phase PM2 + editor 5F

**Notes:** `.project/notes/play-area-PM3-line-of-sight.md`

### Goals

- Move from open-circle reveals to obstacle-aware visibility polygons using editor-authored wall geometry
- Feed CPU-computed polygons into the existing PM2 GPU mask pipeline

### Tasks

- [x] Load scene wall geometry (from editor 5F) into the play-area canvas state and invalidate on `editor:walls:updated`
- [x] Add shared types to `shared/src/types/play-area.ts`: `VisibilityPolygon`, `RaycastHit`, `ObstacleBounds`
- [x] Implement raycasting from units/reveal emitters: gather corner angles with ± offsets, cast rays, build CCW polygons
- [x] Limit raycast work with spatial partitioning or local obstacle bucketing instead of full-scene scans
- [x] Throttle or schedule LOS recomputation so visibility updates remain smooth under movement
- [x] Render LOS polygons into the PM2 mask pipeline rather than treating raycasting as a separate overlay system
- [x] Add door open/close interaction in play mode (players click doors; toggles `isOpen`, recomputes LOS)
- [x] Socket events: `play-area:vision:refresh`, `play-area:vision:updated`, `play-area:door:toggle`, `play-area:door:toggled`
- [x] Tests: ray-segment intersection math, polygon sorting, obstacle culling, LOS throttling, door toggle auth, role-safe delivery
- [x] (Added in review) Light emitters (authored 5G + temporary PM4) reveal their wall-clipped radius to players who have line of sight to the light

### Decisions

- Wall geometry is authored in editor 5F and read-only in play-area except door `isOpen` state — all other edits go through editor
- Observers follow DM-selected LOS (revisit in PM6 if a read-only camera mode is needed)
- CPU raycasting generates polygons; GPU mask composition renders them — complementary, not competing
- LOS is computed server-side and delivered role-gated via `play-area:vision:updated`: DM gets everything; players get party polygons (player-owned + ally NPC tokens), party-visible lights, and only doors the party can see; observers get nothing (kept the 4F.1 observer rule — no DM-selected view exists yet)
- Tokens with no wall inside their vision circle get no polygon and keep the cheaper circular reveal; lights always produce a polygon
- `vision:updated` is emitted immediately before `token:vision:sync`; the client buffers polygons and applies them in the same React batch as reveals so a moved token never renders a circle through a wall
- All vision recomputes for a scene run through one serialized trailing-throttle scheduler (200 ms) — no starvation under continuous movement, no out-of-order broadcasts; door toggles and REST token changes use its immediate `runNow` path
- `vision:refresh` is DM-only and sent by the DM client after `editor:walls:updated` / `editor:lights:updated`; temporary light changes recompute server-side
- Door toggle: DM any door; players only doors visible to the party on the active scene (unseen doors answer `NOT_FOUND` so ids cannot be probed); observers forbidden; 250 ms per-user cooldown; conditional update prevents double-toggle races
- Persistent exploration from obstructed tokens records only the circle inscribed in the visibility polygon, so exploration never uncovers anything behind a wall; lit areas never count as explored
- A light is party-visible when any party token has unlimited-range line of sight to the light's origin; its whole wall-clipped area is then shown and its glow rendered. Lights the party cannot see are hidden (area and glow) for players and in the DM player-view preview
- Door markers render in a `DoorLayer` above the ForegroundLayer so visible doors stay clickable over fog; hidden in editor mode

### Performance Targets

- Maintain 60 FPS with at least 4 moving LOS emitters and 200+ relevant obstacle segments in the active area
- Keep LOS recomputation under 8 ms for a standard combat scene after spatial filtering

---


