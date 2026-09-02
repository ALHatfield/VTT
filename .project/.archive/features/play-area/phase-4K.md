# Archived Phase 4K: Drawing Tools

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-09-01

---

## Phase 4K: Drawing Tools

**Dependencies:** Phase 4F.3

### Overview

Adds ephemeral freehand and shape drawing tools with real-time broadcast. Full front-to-back feature: new tool modes, PixiJS rendering, socket relay handlers, and shared payload types.

### Tasks

**Drawing tool modes**

- [x] Add `'draw-freehand'` and `'draw-shape'` to tool mode union type in `useToolMode`
- [x] Add Draw tool icon to `CanvasToolbar` with sub-mode selector (Freehand / Rectangle / Circle) — visible to DM and Player
- [x] Stroke color picker (defaults to a preset color; integrates with player campaign color after Phase 4J) and line width selector in draw tool panel

**Freehand drawing**

- [x] Click-and-drag to draw freehand strokes on the canvas
- [x] Render strokes as PixiJS `Graphics` paths on `PlaygroundLayer` (above grid, below tokens)
- [x] Stream stroke data in chunks during drag (~30fps throttle) so other players see strokes in progress
- [x] On mouseup, finalize stroke and add to local drawing list

**Shape drawing**

- [x] Rectangle: click-drag defines opposite corners, renders outline
- [x] Circle: click-drag defines center and radius, renders outline
- [x] Shapes use configured stroke color and line width

**Socket broadcast**

- [x] Server socket handler: `play-area:draw:stroke` — relay stroke chunk data to campaign room
- [x] Server socket handler: `play-area:draw:clear` — relay clear action to campaign room
- [x] Shared types in `shared/types/play-area.ts`: `DrawStrokePayload` (points array, color, width, shapeType), `DrawClearPayload` (scope: 'all' | 'own', userId)

**Clear drawings**

- [x] "Clear drawings" button in draw tool panel
- [x] DM clears all drawings; Player clears only their own
- [x] Clear action broadcast via socket so all clients remove the appropriate drawings

**Tests**

- [x] Freehand stroke renders correctly on canvas and clears on tool switch
- [x] Shape tool draws rectangle and circle with correct dimensions
- [x] Stroke data relayed via socket to other clients in real-time
- [x] Clear action respects role: DM clears all, Player clears own
- [x] Drawing throttle does not exceed ~30 events/second

### Decisions

- Drawings are ephemeral (not persisted to DB) for MVP — used for quick annotations during play
- Persisted drawings (saved per scene) deferred to a later phase
- Polygon/line tool (vertex-based), text tool, fill color, and drawing grouping all deferred
- Drawings render on PlaygroundLayer, not on a separate drawing layer
- Server relays validated client stroke color (not player campaign color) since draw has a user-controlled color picker
- Clear button clears the local canvas optimistically (immediate) and emits socket event for remote clients; `onDrawCleared` is a no-op on the sender after the optimistic clear
- Mid-stroke tool deactivation emits `draw:clear` with `scope: 'own'` to clean up in-progress strokes on remote clients
- Freehand strokes seed the start point on `pointerDown` then send delta points (one per move) to avoid duplicating the accumulated array on each frame

---


