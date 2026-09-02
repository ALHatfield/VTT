# Archived Phase 5C: Layer Management & Inspector

- Feature: `editor`
- Source: `.project/features/editor.md`
- Archived: 2026-08-27

---

## Phase 5C: Layer Management & Inspector

**Dependencies:** Phase 5B

### Tasks

**Layer panel**

- [x] Layer panel sidebar (Photoshop-style) — lists tiles grouped by category (BG / Play / FG)
- [x] Visibility toggle (eye icon) per layer
- [x] Lock toggle (prevent accidental edits) per layer
- [x] Drag-to-reorder tiles within a layer (updates z-index)

**Tile inspector**

- [x] Tile inspector component with editable fields: position (x, y), rotation, scale, z-index
- [x] Tile inspector: pixel-level width/height dimension fields for manual precision
- [x] Tile inspector: "Grid cell size (px)" input — when DM enters a value, auto-calculate scale factor (`canvasGridSize / assetGridSize`)

**Tile operations**

- [x] Delete tile (from layer panel or canvas)
- [x] Right-click context menu (rotate 90°/180°/270°, delete, duplicate)
- [x] Batch editing: select multiple tiles, apply transforms to all

**Tests**

- [x] Tests: layer ordering, visibility toggle, dimension fields, grid cell size calc, batch operations

### Decisions

- Grid cell size input is a shortcut for DMs who know their map's px-per-cell — the system does the math instead of the DM
- Layer panel groups tiles by their fixed category, not user-created layers — matches the three-container PixiJS architecture

---


