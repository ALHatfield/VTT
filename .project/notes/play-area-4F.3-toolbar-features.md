# play-area: Toolbar Features

**Created:** 2026-06-10
**Affects:** play-area feature, editor feature (foreground management overlaps with editor scenes)

## Covers

- `4F.3` in `.project/features/play-area.md`
- Potential reorganization of `4H` (Turn Tracker) as a toolbar tool

## Purpose

Phase 4F.3 was originally scoped as a narrow "DM Toolbar" with two tools (NPC token placement, fog vision toggle). This note expands the scope to define a **unified toolbar** accessible to both DMs and Players, where DM-only tools are conditionally rendered based on role. The features below are distilled from Roll20's toolbar reference and adapted for VTT's architecture (PixiJS canvas, Socket.IO, Prisma/Postgres). This note is intended for the `project-manager` agent to read and decompose into buildable sub-phases.

## Key Architectural Decision: Unified Toolbar

The toolbar is **one component** — not a "DM toolbar" and a "Player toolbar." All users see the same toolbar shell. DM-only tools are hidden for Player/Observer roles via the existing `useAuth` context role guard. This simplifies the component hierarchy and avoids maintaining two parallel toolbar UIs.

**Toolbar position:** Docked to the left edge of the play area canvas (vertical strip).
**Behavior:** Collapsible, icon-based with tooltip labels. Active tool is highlighted. Only one tool is active at a time (radio-button pattern), except for persistent overlays like Turn Tracker.

## Tool Inventory

Below is every tool distilled from Roll20's toolbar, categorized by availability and mapped to VTT concepts. Each tool includes what to build for MVP vs what to defer.

### 1. Select Tool (DM + Player)

**Roll20 ref:** Select mode allows clicking to select objects (tokens, drawings), drag-to-select, resize, move. Modifier keys filter selection (Ctrl = tokens only, Alt = drawings only).

**VTT scope:**
- Select individual tokens by clicking
- Drag-select multiple tokens (rubber-band rectangle)
- Move selected tokens (drag or arrow keys)
- Resize tokens (DM only — corner handles)
- Right-click context menu on selected token (inspect, delete for DM)
- Players can only select their own controlled tokens
- DM can select any token on the current layer

**Modifier keys (MVP):**
- Shift+click: add to selection
- Ctrl/Cmd+A: select all on current layer (DM only)

**Notes:** Select is the default active tool when the toolbar loads. Already partially implemented via existing token click/drag handlers — this phase formalizes it as a named tool mode with proper cursor states.

### 2. Pan Tool (DM + Player)

**Roll20 ref:** Click-and-drag to pan around the canvas. Also available via right-click+drag at any time regardless of active tool.

**VTT scope:**
- Dedicated pan mode: left-click+drag pans the viewport
- Right-click+drag always pans (regardless of active tool) — this is a global behavior, not tied to the pan tool specifically
- Cursor changes to grab/grabbing

**Notes:** Pan behavior likely already exists via PixiJS viewport handling. This tool just makes it the primary click action.

### 3. Zoom Tool (DM + Player)

**Roll20 ref:** Toolbar dropdown for preset zoom levels (10% increments), +/- slider, scroll-wheel zoom or pan (configurable), keyboard shortcuts (+/- keys).

**VTT scope:**
- Scroll-wheel zoom (centered on cursor position)
- Zoom slider or +/- buttons in the toolbar panel
- Preset zoom levels dropdown (25%, 50%, 75%, 100%, 150%, 200%)
- Keyboard shortcuts: `+`/`-` to zoom in/out
- Double-click slider to reset to 100%
- Configurable scroll behavior: "scroll to zoom" (default) vs "scroll to pan" (setting per user)

**Notes:** Zoom may not need to be a dedicated "tool" in the radio-button sense — it could be a persistent control in the toolbar that works regardless of active tool. Consider implementing as a toolbar section rather than a tool mode.

### 4. Measure Tool (DM + Player)

**Roll20 ref:** Click-and-drag to measure distance. Snapping modes (center, corner, none). Broadcasting toggle (visible to all or self+DM only). Shape templates: line, square, circle, cone. Waypoints via secondary click. Color follows player color. GM-only measurement style settings (D&D 5E diagonal = 1 unit, Pathfinder diagonal = 1.5 units, Manhattan, Euclidean).

**VTT scope (MVP):**
- Line measurement: click start point, drag to end point, display distance in grid units
- Snap-to-grid-center by default
- Broadcast toggle: show measurement to all players or keep private (DM always sees all)
- Distance calculation uses scene grid settings (cell size in feet/meters)
- Measurement line rendered as a PixiJS graphic overlay on the PlaygroundLayer
- Color matches the player's assigned color
- Socket event: `play-area:measure:broadcast` → server relays to room

**VTT scope (deferred):**
- Area-of-effect shapes (square, circle, cone) — likely a separate sub-phase
- Waypoints (multi-segment measurement paths)
- Configurable diagonal measurement styles (D&D 5E vs Pathfinder)
- Keyboard shortcut `Q` to activate

### 5. Drawing Tools (DM + Player)

**Roll20 ref:** Freehand draw, rectangle/circle shapes (Alt = circle, Shift = snap to grid), polygon/line tool (click vertices, right-click to close), text tool. Configurable stroke color, fill color, line width. Drawings can be grouped. "Clear drawings" button. Drawings exist on a specific layer.

**VTT scope (MVP):**
- Freehand drawing: click-and-drag to draw strokes on the canvas
- Shape tool: rectangle and circle primitives
- Configurable stroke color and line width (secondary toolbar or popover)
- Drawings render on the PlaygroundLayer (above background, below foreground)
- Drawings are ephemeral by default (not persisted to DB) — used for quick annotations during play
- "Clear all drawings" action (DM only clears all; players clear only their own)
- Socket broadcast: `play-area:draw:stroke` → server relays drawing data to room in real-time

**VTT scope (deferred):**
- Polygon/line tool (vertex-based)
- Text tool (place text labels on canvas)
- Fill color for shapes
- Grouping drawings
- Persisted drawings (saved to DB per scene)
- Drawing on specific layers (DM layer, map layer)

**Notes:** Freehand drawing data should be streamed in chunks during drag (not just on mouseup) so other players see the stroke in progress. Consider throttling to ~30fps to avoid flooding the socket.

### 6. Effects (FX) Tool (DM Only)

**Roll20 ref:** Particle effect system with built-in presets (beam, bomb, breath, burn, burst, explode, glow, missile, nova, sparkle, splatter, etc.) and custom effect JSON definitions. Effects are click-to-place or aimed (click-drag for direction). Configurable properties: angle, speed, size, lifespan, color, gravity, particle count.

**VTT scope (MVP):**
- Click-to-place preset effects: explosion, fire, magic glow, sparkle (4–6 presets)
- Effects render as PixiJS particle containers on the PlaygroundLayer
- Duration-limited (auto-remove after effect completes, ~2 seconds max)
- DM triggers effects; all players see them
- Socket event: `play-area:fx:trigger` → server broadcasts `play-area:fx:triggered` with effect type + world position

**VTT scope (deferred):**
- Aimed effects (click-drag for directional beam/breath)
- Custom effect editor (JSON-based particle config)
- Effect persistence or replay
- Cone/line/area effect shapes (overlaps with Measure tool AoE)

**Notes:** Particle rendering should use PixiJS `ParticleContainer` for performance. Effects are fire-and-forget — no DB persistence needed.

### 7. Lighting Tool (DM Only)

**Roll20 ref:** Place light-emitting tokens (bright + low light radius). Place doors (open/closed/locked/secret states). Place windows (see-through, optionally passable). These are building blocks for Dynamic Lighting.

**VTT scope (MVP):**
- Place light sources on the canvas: click to place a light token with configurable bright/dim radius
- Light token settings: bright radius, dim radius, color, visibility toggle
- Lights stored in DB (scene-level, like tokens)
- Lights affect fog-of-war reveal (ties into existing ForegroundLayer fog system)

**VTT scope (deferred):**
- Doors and windows (interactive elements with open/closed/locked states)
- Dynamic lighting with line-of-sight occlusion (walls block light)
- Light animation (flicker, pulse)

**Notes:** Lighting is deeply coupled with the fog-of-war system (Phase 4F) and the post-MVP line-of-sight work (PM3). MVP lighting may be limited to "light sources that define vision radius" without wall occlusion. See also `.project/notes/play-area-PM4-lighting-effects.md`.

### 8. Fog of War Tool (DM Only)

**Roll20 ref:** Hide/reveal mask tool for manually painting fog areas. Roll20 separates this from Dynamic Lighting-based vision.

**VTT scope:**
- Already covered by Phase 4F.1 (fog regions) and 4F.2 (fog drawing/reveal)
- Toolbar integration: fog draw/reveal mode as a tool in the unified toolbar
- Fog vision toggle (dm/player view mode) — already scoped in current 4F.3

**Notes:** No new work needed beyond integrating existing fog tools into the toolbar shell. The fog tool in the toolbar activates the fog drawing mode that 4F.2 implements.

### 9. Turn Tracker (DM Only to Open, Visible to All)

**Roll20 ref:** Interactive turn order list. DM opens/closes it. Add turns via right-click on token. Initiative values (manual entry or drag roll result). Sort (numeric, alphabetic). Advance/go-back buttons. Custom items (round counter with +1/-1 per rotation). DM sees all; players see only their page's entries. Turn tracker persists across page switches.

**VTT scope:**
- Already Phase 4H — but the **Turn Tracker button** lives in the toolbar
- The toolbar provides the toggle button; clicking it opens the Turn Tracker panel (a separate component, not inline in the toolbar)
- Consider whether 4H should be reorganized as a sub-phase of the toolbar work or remain standalone

**Notes:** The Turn Tracker is unique among toolbar tools — it's not a canvas interaction mode but a panel toggle. The toolbar just needs an icon/button that opens the 4H component. The implementation details stay in 4H.

### 10. Foreground Layer Management (DM Only)

**Roll20 ref:** GM-accessible layer that renders above tokens. Foreground objects (roofs, treetops) automatically fade when player tokens overlap them. Per-object settings: darkness interaction (above/as/below darkness), conditional fade (opacity slider), grid visibility toggle. GM controls: layer opacity slider, show/hide foreground to players.

**VTT scope (MVP):**
- Layer switcher in the toolbar: Tokens / Map / Foreground (DM only)
- Active layer determines which objects the Select tool interacts with
- Foreground objects placed via the editor (Phase editor features) appear on the ForegroundLayer
- DM can toggle foreground visibility for players (show/hide toggle)
- DM opacity slider: controls foreground transparency for the DM view

**VTT scope (deferred):**
- Per-object conditional fade (opacity reduction when player token overlaps)
- Darkness interaction modes (above/as/below)
- Automatic reactions (send-to-chat on overlap, auto-reset)
- Object grouping and batch editing

**Notes:** Foreground management in the toolbar is primarily a **layer switcher** — the heavy ForegroundLayer rendering already exists from Phase 4F. This tool just gives the DM controls to configure it. Per-object reactivity (fade on token overlap) is a significant feature and should be its own sub-phase.

### 11. NPC Token Placement (DM Only)

Already scoped in the current Phase 4F.3 tasks. Drag-and-drop generic NPC tokens (Ally/Enemy) onto the canvas.

**Notes:** This could live as a section within the toolbar, or as a popover from the Select tool when in DM mode. Keep current scope.

### 12. Dice (DM + Player)

Already Phase 4E (chat-integrated dice rolling) and PM1 (3D dice). The toolbar may include a quick-roll button but the dice system is independently scoped.

## Toolbar Shell Architecture

```
┌─────────────────────────┐
│  Toolbar (vertical)     │
├─────────────────────────┤
│  [Select]  ← default    │  DM + Player
│  [Pan]                   │  DM + Player
│  [Zoom +/-]              │  DM + Player  (persistent control, not a mode)
│  ─────────────────────── │
│  [Measure]               │  DM + Player
│  [Draw]                  │  DM + Player
│  ─────────────────────── │
│  [Effects FX]            │  DM Only
│  [Lighting]              │  DM Only
│  [Fog of War]            │  DM Only
│  [NPC Tokens]            │  DM Only
│  ─────────────────────── │
│  [Turn Tracker]          │  DM Only (toggle)
│  ─────────────────────── │
│  Layer Switcher          │  DM Only
│  [Tokens] [Map] [FG]    │
└─────────────────────────┘
```

## Suggested Sub-Phase Decomposition

The current 4F.3 is too narrow for all this work. Suggested breakdown for the `project-manager` agent to refine:

| Sub-Phase | Name | Tools Included | Dependencies |
|-----------|------|----------------|-------------|
| 4F.3a | Toolbar Shell + Select/Pan | Toolbar component, tool mode state, Select tool, Pan tool, cursor states | 4F.2 |
| 4F.3b | Zoom + Measure | Zoom controls, Measure tool (line only), broadcast, distance calc | 4F.3a |
| 4F.3c | Drawing Tools | Freehand, shapes, stroke color/width, real-time broadcast, clear | 4F.3a |
| 4F.3d | DM Canvas Tools | NPC placement (existing), Fog tool integration (existing), Layer switcher, Foreground controls | 4F.3a, 4F.2 |
| 4F.3e | Effects (FX) | Preset particle effects, click-to-place, broadcast | 4F.3a |
| 4F.3f | Lighting (Basic) | Place light sources, radius config, fog integration | 4F.3a, 4F.2 |

**Turn Tracker (4H)** stays as its own phase but the toolbar shell (4F.3a) should include the toggle button placeholder.

---

## Developer Notes

**Added:** 2026-06-10

Issues identified during review of the note against the existing codebase, with resolutions.

### DN-1: Two Toolbars — Campaign Toolbar vs Canvas Toolbar

**Issue:** The existing `PlayAreaToolbar.tsx` is a horizontal top-bar with navigation ("← Back"), placeholder buttons (Campaign Notes, Inventory), and fog mode toggles. The note describes a vertical left-dock toolbar for canvas tools. These are two different UI elements.

**Resolution:** Keep both as separate components:
- **Campaign Toolbar** (top bar) — rename existing `PlayAreaToolbar` to `CampaignToolbar`. Contains navigation, campaign-level actions (notes, inventory), and non-canvas controls. Stays horizontal across the top.
- **Canvas Toolbar** (left dock) — new component for all canvas interaction tools (Select, Pan, Zoom, Measure, Draw, FX, Lighting, Fog, Layer Switcher). Vertical strip docked to the left edge.

The fog mode buttons currently in the top bar should migrate to the Canvas Toolbar under the Fog of War tool section. The top bar keeps only navigation and campaign-level UI.

### DN-2: Pan/Zoom Migration to Tool Mode System

**Issue:** Pan is currently always-on via left-click-drag on the canvas wrapper div (suppressed during token drag). Zoom is always-on via scroll-wheel. Neither is gated by a tool mode. Introducing a radio-button tool system means Select mode's left-click-drag would rubber-band select instead of pan, breaking the current default behavior.

**Resolution:** Migrate pan/zoom into the tool mode system:
- **Select mode (default):** Left-click on tokens to select/drag. Left-click on empty canvas starts rubber-band selection. Right-click-drag always pans (global, regardless of tool mode).
- **Pan mode:** Left-click-drag pans the canvas.
- **Zoom:** Not a radio-button tool mode — stays as a persistent control. Scroll-wheel zoom always works regardless of active tool. Add visible `+`/`-` zoom buttons in the **top-right corner** of the canvas (floating overlay, not inside the toolbar).
- All existing pointer handlers in `PlayArea.tsx` must be refactored to dispatch through a `useToolMode` hook that gates behavior based on active tool.

### DN-3: Fog Drawing Migration to Canvas Toolbar

**Issue:** Fog drawing has its own modal state (`fogMode: 'off' | 'reveal' | 'hide'`) with dedicated pointer handlers in `PlayArea.tsx`. These need to integrate into the tool mode dispatch system rather than being a parallel overlay.

**Resolution:** Migrate fog draw/reveal/hide into the Canvas Toolbar as a DM-only tool. When the Fog tool is active, the fog drawing pointer handlers take over (same behavior as today, just activated via the canvas toolbar instead of the top-bar buttons). Fog tool becomes one of the radio-button tool modes. The existing fog pointer handler logic in `PlayArea.tsx` stays intact but is gated behind `activeTool === 'fog'` instead of the current `isFogDrawingActive` flag. Other foreground controls (opacity slider, vision toggle) live in the Fog tool's expanded panel.

### DN-4: Drawing Tool — Full Stack Required

**Issue:** Drawing tools (freehand, shapes) are brand new. No existing drawing infrastructure exists on client or server. Socket events (`play-area:draw:stroke`) need server handlers, even if drawings are ephemeral.

**Resolution:** This is a full front-to-back feature:
- **Client:** New drawing interaction mode in the tool system, PixiJS `Graphics` rendering on PlaygroundLayer, stroke color/width config UI.
- **Server:** New socket event handlers for `play-area:draw:stroke` (relay to room), `play-area:draw:clear` (relay to room). Server is a relay only — no DB persistence for MVP.
- **Shared:** New event payload types in `shared/types/play-area.ts` (`DrawStrokePayload`, `DrawClearPayload`).
- Must be planned as its own sub-phase with socket handler registration, not bundled as "just a toolbar button."

### DN-5: Player Color — Generation Strategy

**Issue:** Measure tool and drawing tools reference "player color" but no color field exists on `User` or `CampaignPlayer`.

**Resolution:** Two options:
1. **Deterministic generation** — hash `userId` or `campaignPlayer.id` to a hue. Cheap, no schema change, but colors may collide.
2. **Stored on `CampaignPlayer`** — add a `color` column. Allows DM or player to customize. Requires a migration.

Recommendation: Store in `CampaignPlayer` (option 2). Player color is campaign-scoped (you might be red in one campaign and blue in another). The character table is the wrong place — a player may not have a character but still needs a color for measure/draw tools. Add a default color assigned on join (cycle through a preset palette based on join order).

### DN-6: Layer Switcher — Major Canvas Refactor (HIGHEST PRIORITY)

**Issue:** The layer switcher implies DM can select objects on different layers (Tokens, Map, Foreground). But the current canvas architecture is minimal:
- `BackgroundLayer` holds only a single map image sprite.
- `PlaygroundLayer` holds grid + tokens.
- `ForegroundLayer` holds fog overlays.

There are no "foreground objects" (roofs, trees, decorations) in the object model. No `eventMode` on background/foreground elements. The Select tool can only interact with `TokenSprite` objects. Supporting selectable objects on multiple layers requires:
- A concept of "scene objects" beyond tokens (foreground decorations, map overlays).
- Per-layer hit testing gated by the active layer selection.
- Potentially new DB models for scene objects on each layer.

**Resolution:** This is the **most important prerequisite** and should be addressed first. The canvas stage needs a thorough architectural plan for multi-layer object interaction before any toolbar tool can meaningfully use a layer switcher. This likely involves:
1. A PixiJS architecture spike to design how layer-aware hit testing works.
2. Defining the data model for non-token scene objects (or deferring foreground objects entirely and keeping the layer switcher as "which layer's tokens are interactive").
3. This work may overlap with the Editor feature (Phase 5A–5E), which would be where foreground objects are actually placed.

**Recommendation:** Plan this as the first sub-phase. Even if MVP only supports switching between "Tokens are interactive" vs "nothing is interactive" (for safe panning on busy maps), the architecture must be extensible. The layer switcher UI can ship with just Tokens/Map toggle initially, with Foreground added when the object model exists.

### DN-7: PixiJS v8 Particle System

**Issue:** The note references `ParticleContainer` for effects, but PixiJS v8 significantly changed the particle API. The legacy `ParticleContainer` from v7 may not exist or behave differently.

**Resolution:** Flag this for a spike during the Effects (FX) sub-phase. Check `@pixi/particle-emitter` compatibility with v8 or plan to use raw `Graphics`/`Sprite` animation with `PIXI.Ticker`. Existing note `play-area-general-pixijs-v8.md` should be consulted and updated with particle rendering findings.

### DN-8: Lighting Tool vs Post-MVP Phase Overlap — Phase Reorganization

**Issue:** The toolbar's "basic lighting" (4F.3f) overlaps with PM3 (Line of Sight) and PM4 (Lighting Effects). Building light placement now risks creating infrastructure that PM3/PM4 will redesign. Additionally, the entire toolbar work expands 4F.3 far beyond its original scope, and future phases downstream of 4F.3 may need reorganization.

**Resolution:** After the Canvas Toolbar shell is established (4F.3a equivalent), each toolbar feature should be developed **in sync with its corresponding phase**. Rather than building all tools in one monolithic 4F.3 expansion:
- Fog tool in the toolbar lands with 4F fog phases (already done, just migrating the UI).
- Lighting tool in the toolbar lands alongside PM3/PM4 when lighting is properly designed.
- Effects tool can be its own standalone phase.
- Turn Tracker button lands when 4H ships.

This means **future phases may need reorganization** to include "add toolbar integration" as a task within each feature phase, rather than front-loading all toolbar tools into 4F.3. The `project-manager` agent should evaluate whether the current phase graph needs an overhaul after the toolbar shell exists.

### DN-9: Turn Tracker Dependency

**Issue:** Same as DN-8. Turn Tracker (4H) depends on 4F.3 in the roadmap, but 4F.3 is now decomposed into sub-phases.

**Resolution:** 4H depends on 4F.3a (toolbar shell) specifically, not on all of 4F.3. The dependency graph should be updated after the phase reorganization in DN-8. The toolbar shell just provides a toggle button; 4H's implementation is independent.

### DN-10: Keyboard Shortcuts — Low Priority

**Issue:** Multiple tools reference keyboard shortcuts but no centralized shortcut system exists. The chat input captures keystrokes when focused.

**Resolution:** Lowest priority. Defer keyboard shortcuts to after all toolbar tools are functional via mouse interaction. When addressed:
- Centralized key handler at the `PlayArea` level.
- Suppress shortcuts when chat input or any text field is focused.
- Make shortcuts configurable (not hardcoded).

### DN-11: Observer Role — Canvas Toolbar Access

**Issue:** The note doesn't specify Observer behavior. Observers are read-only.

**Resolution:** Observers see the Canvas Toolbar but only have access to **Pan and Zoom**. All other tools are hidden. The toolbar shell should gate tool visibility by role:
- **DM:** All tools visible.
- **Player:** Select, Pan, Zoom, Measure, Draw visible. DM-only tools hidden.
- **Observer:** Pan and Zoom only.

This is a three-tier visibility model, not just DM/non-DM. The `useToolMode` hook (or the toolbar component) needs role-aware tool filtering.

### Summary: Execution Order

Based on the above, the recommended order for the `project-manager` agent:

1. **DN-6 first** — Canvas architecture spike for multi-layer object interaction and tool-mode-aware hit testing. This is the foundation everything else builds on.
2. **DN-1 + DN-2 + DN-3** — Toolbar shell (Canvas Toolbar component), tool mode state management (`useToolMode`), migrate pan/zoom/fog into tool modes. Rename existing toolbar to `CampaignToolbar`.
3. **DN-11** — Role-aware tool visibility (DM / Player / Observer) baked into the shell from day one.
4. **DN-8** — Re-evaluate phase graph. Each future feature phase includes its own toolbar integration rather than front-loading all tools.
5. **DN-4, DN-5** — Drawing tools and player color as new sub-phases.
6. **DN-7** — PixiJS v8 particle spike before Effects tool.
7. **DN-10** — Keyboard shortcuts last.

## Roll20 Reference Sources

These URLs were used to distill the features above:

- [Toolbar Overview](https://help.roll20.net/hc/en-us/articles/360039674753-Toolbar-Overview)
- [Select and Pan Tools](https://help.roll20.net/hc/en-us/articles/360039674873-Select-and-Pan-Tools)
- [Zoom Tool](https://help.roll20.net/hc/en-us/articles/360043082213-Zoom-Tool)
- [Measure Tool](https://help.roll20.net/hc/en-us/articles/360039674913-Measure-Tool)
- [Drawing and Text Tools](https://help.roll20.net/hc/en-us/articles/360039674893-Drawing-and-Text-Tools)
- [Effects (FX) Tool](https://help.roll20.net/hc/en-us/articles/360037258714-Effects-FX-Tool)
- [Lighting Tools](https://help.roll20.net/hc/en-us/articles/4409777746967-Lighting-Tools)
- [Foreground Layer](https://help.roll20.net/hc/en-us/articles/30738192036887-Foreground-Layer)
- [Turn Tracker](https://help.roll20.net/hc/en-us/articles/360039178634-Turn-Tracker)
