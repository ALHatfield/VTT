---
description: "Campaign editor feature — scene editor, asset library, and layer management."
applyTo: "**/features/editor/**"
---
# Feature: editor

> For current phase status and tasks, see `.project/features/editor.md`
> For the mode-toggle architecture, see `.project/notes/editor-5A-editor-mode-integration.md`

The campaign editor is a DM-only mode within the play area for building maps and scenes. It is accessed via an "Editor" button in the campaign toolbar and toggled with a `'play' | 'editor'` mode state — **not** a separate route or page. The PixiJS canvas stays mounted across mode switches; only the surrounding UI panels and interaction handlers change.

## Architecture
- Editor mode is toggled via `EditorModeContext` at the play-area root
- In play mode: canvas toolbar, chat box, dice roller are visible
- In editor mode: asset library, layer management panels are visible
- The canvas remains mounted — interaction handlers swap based on mode
- Mode toggle logic lives in `features/play-area/` (it owns the layout)
- Components exclusive to editor mode live in `features/editor/components/`

## Sub-Features
1. **Asset Library** — Upload, organize, and drag assets onto the canvas
2. **Scene Editor Canvas** — PixiJS canvas in edit mode with tile placement, selection, and grid snapping
3. **Layer Management** — Photoshop-style layer panel with properties, visibility, and ordering

## Asset Library
- Assets categorized by layer type: background tiles, playground tokens, foreground effects
- Upload zone accepts image files (PNG, JPEG, WebP) with drag-and-drop
- Assets stored in `tile_assets` table with campaign scoping
- Thumbnails generated and displayed in a browsable gallery
- Drag asset from library → drop onto canvas to create a placement

## Scene Editor Canvas
- Reuses `CanvasManager` with editor-specific interaction handlers
- DM can select, move, resize, and rotate tiles on the canvas
- Grid snapping for precise placement; Alt+drag to bypass snapping
- Multi-select with bounding box for batch operations
- Undo/redo support for all canvas mutations

## Layer Management
- Each asset placed on the canvas exists in a layer
- Layer panel (sidebar) shows all placed assets with:
  - Visibility toggle (eye icon)
  - Lock toggle (prevent accidental edits)
  - Display order (drag to reorder)
  - Properties section (position, rotation, scale, z-index)
- Layers map to the three PixiJS container layers: Background, Playground, Foreground
- Delete layer removes the asset from the scene

## Tile Inspector
- Selected tile shows a properties panel with editable fields:
  - Position (x, y) — grid-snapped
  - Rotation (0°, 90°, 180°, 270°)
  - Scale factor
  - Pixel-level width/height dimensions
  - "Grid cell size (px)" — auto-calculates scale factor
  - Z-index within its layer
- Batch editing: select multiple tiles, apply transformations to all

## Grid Alignment
- Manual trace mode: DM draws a rectangle over a 3×3 grid section; system calculates and resizes tile to match canvas grid
- Auto-detection via edge detection as a secondary enhancement
- Alignment always resizes the **tile**, never the canvas grid

## Access Control
- Editor mode is DM-only — guarded by `useCampaignRole` hook
- Editor API routes require `dm` role via `requireRole('dm')` middleware
- Players and Observers cannot see the Editor button or access editor routes

## Prior Art (Project_Pathfinder)
- `CampaignEditorPage` with integrated canvas and sidebar panels
- `TilePlacementCanvas` — canvas component for tile editing
- `AssetLibrary` + `AssetUploadZone` — upload and browse assets
- `LayerPanel` — layer management sidebar
- `TileInspector` + `TileContextMenu` — property editing and right-click actions
- `useTileDragDrop` hook — drag-and-drop logic for tile placement
- `useUndoRedoMap` hook — undo/redo state management
- Backend: `AssetService`, `TilePlacementService`, `MapLayerService`
- 3 REST endpoints for asset management, tile placement tables

## Integration Points
- **Campaigns**: Editor is accessed from the campaign detail page (DM only)
- **Play Area**: Maps built in the editor are loaded into the play area canvas
- **Assets**: Uploaded assets are stored per-campaign and referenced by tile placements
