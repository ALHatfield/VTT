# Feature: editor

> **Slug:** `editor`
> **Feature dirs:** `client/src/features/editor/`, `server/src/features/editor/`
> **Instructions:** `.github/instructions/feature-editor.instructions.md`
> **Shared types:** `shared/types/editor.ts`

---

## Current Status

| Phase | Name                              | Status      |
| ----- | --------------------------------- | ----------- |
| 5B    | Scene Editor Canvas & Persistence | Not Started |
| 5C    | Layer Management & Inspector      | Not Started |
| 5E    | Grid Alignment Tool               | Not Started |

---

## Phase 5B: Scene Editor Canvas & Persistence

**Dependencies:** Phase 5A.1, play-area Phase 4A

> **Pathfinder port:** See `.project/handoffs/editor-5B-pathfinder-port.md` for a full inventory of what's already built vs. what to port. Short version: data model, persistence API, undo/redo, asset library, upload zone, and layers panel are **all complete**. The remaining work is the canvas component, drag-drop hook, and tile context menu.

### Tasks

**Data model**

- [ ] Define `TilePlacement` shared type in `shared/src/types/editor.ts`
- [ ] Add `TilePlacement` Prisma model (links a `TileAsset` to a scene with position, rotation, scale, z-index, and layer category)
- [ ] Run migration

**Canvas interactions**

- [ ] `useTileDragDrop` hook — grid-snap math, `dataTransfer` → `CreateTilePlacementPayload`, Alt+drag bypass (port from Pathfinder `frontend/src/hooks/useTileDragDrop.ts`)
- [ ] Editor-mode PixiJS canvas (reuses CanvasManager with editor interaction handlers, reads mode from `EditorModeContext`)
- [ ] Drag asset from library → drop onto canvas to create tile placement
- [ ] Select tile on canvas (click), show selection handles
- [ ] Add a right-click menu to selected tile
- [ ] Move selected tile (drag)
- [ ] Resize tile (drag handles)
- [ ] Rotate tile (context menu or handles)
- [ ] Grid snapping for precise placement
- [ ] Alt+drag modifier to bypass grid snapping for sub-grid positioning
- [ ] Smart Sizing prompt: when DM drops a background asset onto an empty BackgroundLayer, offer to resize canvas dimensions to match the image
- [ ] Multi-select with bounding box (shift+click or drag selection)

**Persistence**

- [x] Save tile placements to database (API endpoints: create, update, delete placement)
- [x] Load tile placements when opening editor
- [x] Auto-save on placement changes (debounced)

**Undo/redo**

- [x] `useUndoRedo` hook with command pattern — every action (place, move, resize, rotate, delete) is a command from the start
- [x] Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts

**Tests**

- [ ] Tests: placement logic, grid snapping, snap bypass, smart sizing prompt, selection state
- [ ] Tests: save/load roundtrip, undo/redo stack integrity

### Decisions

- Smart Sizing only triggers on an empty BackgroundLayer, only for images larger than current canvas, and is dismissable with a "don't ask again" preference
- Canvas grid is fixed — all sizing/alignment operations resize the tile, never the canvas (except Smart Sizing which resizes the canvas itself for the initial background)
- `TilePlacement.category` (background/playground/foreground) determines which PixiJS container a tile belongs to — no separate `MapLayer` model needed since layers are fixed
- Undo/redo is client-side only (action stack); persistence writes happen on each action, undo replays the inverse

---

## Phase 5C: Layer Management & Inspector

**Dependencies:** Phase 5B

### Tasks

**Layer panel**

- [ ] Layer panel sidebar (Photoshop-style) — lists tiles grouped by category (BG / Play / FG)
- [ ] Visibility toggle (eye icon) per layer
- [ ] Lock toggle (prevent accidental edits) per layer
- [ ] Drag-to-reorder tiles within a layer (updates z-index)

**Tile inspector**

- [ ] Tile inspector component with editable fields: position (x, y), rotation, scale, z-index
- [ ] Tile inspector: pixel-level width/height dimension fields for manual precision
- [ ] Tile inspector: "Grid cell size (px)" input — when DM enters a value, auto-calculate scale factor (`canvasGridSize / assetGridSize`)

**Tile operations**

- [ ] Delete tile (from layer panel or canvas)
- [ ] Right-click context menu (rotate 90°/180°/270°, delete, duplicate)
- [ ] Batch editing: select multiple tiles, apply transforms to all

**Tests**

- [ ] Tests: layer ordering, visibility toggle, dimension fields, grid cell size calc, batch operations

### Decisions

- Grid cell size input is a shortcut for DMs who know their map's px-per-cell — the system does the math instead of the DM
- Layer panel groups tiles by their fixed category, not user-created layers — matches the three-container PixiJS architecture

---

## Phase 5E: Grid Alignment Tool

**Dependencies:** Phase 5B

### Tasks

- [ ] "Align to Grid" action in tile context menu / toolbar
- [ ] Manual trace mode: DM draws a rectangle over a 3×3 grid section on the tile; system calculates `gridSpacing = tracedWidth / 3`
- [ ] System resizes the tile so `gridSpacing` matches `canvasGridSize`
- [ ] Scale handles for fine-tuning after initial alignment
- [ ] Aspect ratio lock toggle during fine-tune
- [ ] Live canvas preview during adjustment
- [ ] Auto-detection enhancement: Canny/Sobel edge detection to auto-trace for the user
- [ ] Fallback UX: "Grid detection failed. Please adjust manually." (falls back to manual trace)
- [ ] Shared types: `GridAlignmentResult`, `GridDetectionConfig`
- [ ] Tests: manual trace calculation, auto-detection accuracy, tile resize (never canvas), fallback behavior

### Decisions

- **Manual trace is primary**, auto-detection is secondary — manual trace covers more map styles (hand-drawn, hex, partial grids) and is simpler to implement
- Alignment always resizes the **tile asset**, never the canvas grid — multiple tiles with different source grid sizes coexist on the same canvas
- Performance target for auto-detection: <500ms per image, 80%+ accuracy on standard grid maps

---

## Cross-Feature Dependencies

| Depends On         | Why                                                 |
| ------------------ | --------------------------------------------------- |
| campaigns Phase 3A | Editor accessed from campaign detail (DM only)      |
| play-area Phase 4A | Editor reuses CanvasManager and PixiJS layer system |

> **Note:** The play area benefits from editor-authored maps but does not require the editor feature to function. Scene backgrounds can be set without the editor.

---

## Architectural Decisions (from Project_Pathfinder)

**What worked well:**

- 12-component decomposition for the editor (AssetLibrary, AssetUploadZone, LayerPanel, TilePlacementCanvas, TileInspector, TileContextMenu, MapEditorPage, etc.) — good granularity
- `useTileDragDrop` hook encapsulating all drag-and-drop logic — keeps components clean
- `useUndoRedoMap` hook with command pattern for undo/redo — reliable and testable
- Right-click context menu for tile rotations (90°/180°/270°) — intuitive UX
- Keyboard shortcuts: R (rotate), Ctrl+A (select all), Delete, Escape (deselect)
- Grid snapping for precise tile placement
- Multi-select with batch operations for bulk editing
- Asset library categorization by layer type (background, playground, foreground)

**What we're changing:**

- Project_Pathfinder used raw Canvas API for editor → new build uses PixiJS (same renderer as play area)
- Project_Pathfinder tile persistence was incomplete (Phase 3C.4 not started) → new build plans this from the start
- Editor canvas and play-area canvas share the same `CanvasManager` with different interaction modes
