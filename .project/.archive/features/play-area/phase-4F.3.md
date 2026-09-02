# Archived Phase 4F.3: Canvas Toolbar Shell & Navigation

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-08-31

---

## Phase 4F.3: Canvas Toolbar Shell & Navigation

**Dependencies:** Phase 4F.2
**Notes:** `.project/notes/play-area-4F.3-toolbar-features.md`

### Overview

Establishes the tool-mode architecture, refactors existing pointer handling, and delivers the toolbar shell with Select, Pan, and Zoom — the foundation all future tools plug into. The existing top-bar `PlayAreaToolbar` is renamed to `CampaignToolbar` (navigation only); a new vertical `CanvasToolbar` docks to the left edge for all canvas interaction tools.

### Tasks

**Canvas architecture refactor**

- [x] Refactor pointer handling in `PlayArea.tsx` to dispatch through a centralized tool-mode system instead of hardcoded pan/fog/select logic
- [x] Create `useToolMode` hook — manages active tool state (`'select' | 'pan' | ...`), exposes `activeTool` and `setActiveTool`
- [x] Gate all pointer handlers (pointerdown/move/up) behind `activeTool` so each tool mode owns its own interaction behavior
- [x] Implement right-click-drag pan as a global behavior available in all tool modes (not tied to Pan tool)

**Toolbar shell**

- [x] Build `CanvasToolbar` component — vertical strip docked left, icon-based with tooltip labels, radio-button pattern for tool modes
- [x] Rename existing `PlayAreaToolbar` to `CampaignToolbar` — keeps navigation ("← Back") and campaign-level buttons only
- [x] Integrate `CanvasToolbar` into `PlayArea.tsx` — visible to all roles
- [x] Style toolbar with CSS Modules; active tool highlighted; collapsible with plain CSS transition

**Tool: Select (default)**

- [x] Select tool mode: click token to select, drag token to move (carries forward existing behavior)
- [x] Rubber-band rectangle selection: click-drag on empty canvas draws selection box, selects all tokens within bounds
- [x] Players can only select their own controlled tokens; DM can select any token
- [ ] Cursor states: `default` when hovering empty canvas, `pointer` over interactive tokens, `move` while dragging

**Tool: Pan**

- [x] Pan tool mode: left-click-drag pans the viewport (same behavior as current default, but now gated behind tool mode)
- [x] Cursor states: `grab` when idle, `grabbing` while dragging

**Zoom controls (persistent, not a tool mode)**

- [x] Scroll-wheel zoom remains always-on regardless of active tool
- [x] Add floating `+`/`-` zoom buttons in top-right corner of the canvas (HTML overlay, not inside toolbar)
- [x] Zoom buttons call existing `CanvasManager.zoom()` with fixed delta values

**Role-based tool visibility**

- [x] DM sees all tools; Player sees Select + Pan; Observer sees Pan only (Pan is default for Observer)
- [x] Gate via `useCampaignRole` hook in `CanvasToolbar`
- [x] Future phases add new tools without modifying this gating pattern

**Tests**

- [x] Tool mode switches correctly and pointer behavior changes per mode
- [x] Right-click-drag pans in all tool modes
- [x] Select tool: rubber-band selection selects correct tokens
- [x] Zoom buttons call `CanvasManager.zoom()` correctly
- [x] Role gating: correct tools visible per role (DM/Player/Observer)

### Decisions

- The toolbar is a unified component — role gating hides tools, not components
- Zoom is a persistent control (floating buttons + scroll wheel), not a tool mode
- Right-click-drag pan is global, available in every tool mode — users never lose the ability to pan
- The existing `PlayAreaToolbar` becomes `CampaignToolbar` for navigation; canvas tools live exclusively in `CanvasToolbar`
- Future phases add new tools to the toolbar (Fog → 4F.4, NPC → 4F.5, Measure → 4J, Drawing → 4K, Turn Tracker toggle → 4H)
- Keyboard shortcuts deferred — all tools are mouse-activated only in this phase
- `ToolMode` type is owned by `CanvasManager.ts` and re-exported from `useToolMode.ts` to avoid duplication
- Activating Pan tool automatically clears fog draw mode to prevent overlay z-index collision
- Rubber-band token selection only includes tokens where `canInteract === true` — consistent with single-click selection permission model

---


