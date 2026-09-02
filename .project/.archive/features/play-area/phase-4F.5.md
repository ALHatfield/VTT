# Archived Phase 4F.5: NPC Token Placement Tool

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-09-01

---

## Phase 4F.5: NPC Token Placement Tool

**Dependencies:** Phase 4F.3

### Overview

Adds a DM-only tool for placing NPC tokens directly from the canvas toolbar via drag-and-drop.

### Tasks

- [x] Add `'npc-place'` to tool mode union type in `useToolMode`
- [x] Add "NPC Tokens" section to `CanvasToolbar` with drag sources for "Ally" and "Enemy" generic tokens
- [x] Add `useNpcDrop` hook: `dragstart` sets `npcSubtype` in `dataTransfer`; canvas `drop` handler converts pixel coordinates to grid cell coordinates and calls `POST /api/campaigns/:id/scenes/:sceneId/tokens` with `type: 'npc'`, `npcSubtype`, and a default name
- [x] NPC tool is DM-only (gated by role check in `CanvasToolbar`)
- [x] Tests: NPC drag payload sets correct `npcSubtype` and drop creates token

### Decisions

- NPC token placement is a toolbar tool, not a context menu action
- DM-only visibility
- `useNpcDrop` provides canvas-side drag-over/drop handlers; drag-start is handled inline in `CanvasToolbar`
- Grid snapping uses `Math.round` (snap to nearest cell) for consistency with the playground-asset token path
- Combined canvas drag handler calls tile and NPC handlers in sequence — each guards on its own MIME type, so they cannot conflict
- `DEFAULT_NPC_SIZE = 1` constant used instead of magic number

---


