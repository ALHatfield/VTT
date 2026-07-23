# Handoff — Project Pathfinder Port: Phase 5B

**Source:** `C:\Users\Hatty\Desktop\Project_Pathfinder`
**Relevant Pathfinder phase:** Phase 3C (tile assets, map layers, tile placements)

A significant portion of Phase 5B already exists in VTT. The API, DB model, shared types, undo/redo hook, asset library, upload zone, layers panel, and `useTilePlacements` are all complete. What remains to build is primarily the **PixiJS canvas component** and the **drag-drop hook** — both of which can be ported directly from Pathfinder's logic, swapping the raw Canvas 2D API for PixiJS.

---

## What VTT Already Has (Do Not Rebuild)

| VTT File                                                      | Pathfinder Equivalent                           | Notes                                                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `shared/src/types/editor.ts`                                  | `frontend/src/types/TileAsset.ts`               | VTT version is richer — has `scale`, `width`, `height` on placement                                       |
| `server/src/features/editor/editor.routes.ts`                 | `backend/src/routes/tiles.ts`                   | VTT uses session auth + Zod validation (superior to Pathfinder's JWT + manual checks)                     |
| `server/src/features/editor/editor.service.ts`                | `backend/src/services/TilePlacementService.ts`  | VTT uses Prisma; Pathfinder used raw SQL                                                                  |
| `client/src/features/editor/hooks/useTilePlacements.ts`       | `frontend/src/services/tilePlacementService.ts` | VTT is a hook with debounced autosave; Pathfinder was a plain service object                              |
| `client/src/features/editor/hooks/useUndoRedo.ts`             | `frontend/src/hooks/useUndoRedoMap.ts`          | VTT is **superior** — proper command pattern with `execute`/`undo` callbacks; Pathfinder stored snapshots |
| `client/src/features/editor/components/AssetLibrary.tsx`      | `frontend/src/components/AssetLibrary.tsx`      | Done                                                                                                      |
| `client/src/features/editor/components/AssetUploadZone.tsx`   | `frontend/src/components/AssetUploadZone.tsx`   | Done                                                                                                      |
| `client/src/features/editor/components/LayersPanel.tsx`       | `frontend/src/components/LayerPanel.tsx`        | Done                                                                                                      |
| `client/src/features/editor/components/SmartSizingPrompt.tsx` | Not in Pathfinder                               | VTT-only, already built                                                                                   |
| `client/src/features/editor/EditorModeContext.tsx`            | `frontend/src/context/MapEditorContext.tsx`     | VTT has mode; needs tile selection state added                                                            |
| Prisma `TilePlacement` model (migration `20260612221214`)     | SQL `tile_placements` table                     | Done                                                                                                      |

---

## What Needs to Be Built and How to Port It

### 1. `useTileDragDrop` hook

**Pathfinder source:** `frontend/src/hooks/useTileDragDrop.ts`

The grid-snapping math is directly portable. The only change is the coordinate source — Pathfinder reads from a `<canvas>` element's `getBoundingClientRect`; VTT should read from the PixiJS viewport transform.

Core snap formula to keep:

```ts
const x = (e.clientX - rect.left - panX) / zoom;
const snappedX = Math.round(x / gridSize) * gridSize;
```

The `dataTransfer` → `CreateTilePlacementPayload` mapping is identical. `AssetLibrary` sets drag data on `dragstart`; the hook reads it on `drop`. PixiJS renders to a native `<canvas>` element, so the same DOM drag events fire.

**Alt+drag snap bypass** is not in Pathfinder — check `e.altKey` before snapping and pass through the raw coordinate if true.

---

### 2. `TilePlacementCanvas` component (the main build)

**Pathfinder source:** `frontend/src/components/TilePlacementCanvas.tsx`

Pathfinder uses the raw Canvas 2D API. VTT uses PixiJS. The rendering must be rewritten, but the **interaction state machine** can be copied nearly verbatim.

**Copy from Pathfinder:**

- Pan/zoom state (`panX`, `panY`, `zoom`) and mouse event handlers for panning
- Tile drag state (`isDraggingTile`, `draggedTileId`, `dragOffset`) and move-tile mouse logic
- Click-to-select logic and shift+click multi-select
- Context menu position/visibility state and right-click handler
- Keyboard shortcuts: `Ctrl+A` (select all), `Delete` (delete selected), `Escape` (deselect), `R` (rotate 90°)

**Rewrite for PixiJS:**

- `drawGrid()` → `Graphics` with `moveTo`/`lineTo` calls
- `drawTile()` → `Sprite` created via `Assets.load(url)`, parented to the correct PixiJS container from `CanvasManager` (`background`, `playground`, or `foreground`) based on `placement.category`
- Selection highlight → border `Graphics` overlay on the selected sprite(s)
- Image cache → use PixiJS `Assets` cache (handled automatically)
- Resize handles → `Graphics` squares on sprite corners, pointer events on each

**Pathfinder's layer model vs. VTT:**
Pathfinder had a dynamic `map_layers` DB table with `terrain`/`object`/`decoration` types and a FK on each placement. VTT's layer model is simpler: `TilePlacement.category` (`background`/`playground`/`foreground`) maps directly to the three pre-existing PixiJS containers in `CanvasManager`. No layer lookup or creation needed — just route each placement to the right container by its `category`.

---

### 3. `TileInspector` component

**Pathfinder source:** `frontend/src/components/TileInspector.tsx`

Portable with minor type changes:

- `position_x`/`position_y` → `x`/`y`
- Remove `z_index` from this component (managed via layer order in Phase 5C)
- Add `width`/`height` fields — VTT stores dimensions on the placement itself, Pathfinder derived them from the asset
- Remove the layer switcher (no dynamic layers in VTT)
- Keep the blur-to-apply pattern — it's correct

---

### 4. `TileContextMenu` component

**Pathfinder source:** `frontend/src/components/TileContextMenu.tsx`

Fully portable. Rotate 90°/180°/270°, delete, and duplicate actions map directly. Pathfinder constrained `rotation` to `0|90|180|270` at the DB level; VTT allows any float, but the context menu buttons can still snap to those four values for convenience.

---

## Key Differences to Watch Out For

| Concern             | Pathfinder                                  | VTT                                                                                    |
| ------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Auth**            | `Authorization: Bearer ${token}` header     | `credentials: 'include'` (session cookie) — already correct in `useTilePlacements.ts`  |
| **Rotation**        | DB CHECK constrains to `0\|90\|180\|270`    | Any float — free-rotate is allowed                                                     |
| **Tile dimensions** | Fixed on `TileAsset` (asset intrinsic size) | Stored on `TilePlacement` (`width`/`height`) — can be resized independently            |
| **Layers**          | Dynamic `MapLayer` rows, FK on placement    | Fixed 3 categories — `placement.category` determines PixiJS container                  |
| **Undo/redo**       | State snapshot comparison (doesn't replay)  | Command pattern with `execute`/`undo` — every action provides its own inverse API call |
| **API URL**         | `PATCH /api/v1/maps/:mapId/tiles/:tileId`   | `PATCH /api/campaigns/:id/scenes/:sceneId/placements/:placementId`                     |
| **Smart Sizing**    | Not implemented                             | `SmartSizingPrompt.tsx` already built — wire it up on background drop                  |

---

## Suggested Build Order

1. **`useTileDragDrop.ts`** — Port the snap math (~50 lines). Unblocks the canvas.
2. **`TilePlacementCanvas.tsx`** — Core of Phase 5B. Copy Pathfinder's interaction state machine; replace 2D canvas rendering with PixiJS sprites on `CanvasManager` containers.
3. **`TileInspector.tsx`** — Quick port with type adjustments.
4. **`TileContextMenu.tsx`** — Quick port.
5. **Wire up `MapEditorPage`** — Compose all pieces. `useTilePlacements` and `useUndoRedo` are ready and waiting.

---

## Where to Look in Pathfinder

| What you need                      | File                                              | Approx. lines        |
| ---------------------------------- | ------------------------------------------------- | -------------------- |
| Grid snap math                     | `frontend/src/hooks/useTileDragDrop.ts`           | 27–35                |
| Pan/zoom + tile drag state         | `frontend/src/components/TilePlacementCanvas.tsx` | 60–85                |
| Grid draw helper                   | `frontend/src/components/TilePlacementCanvas.tsx` | 99–115               |
| Selection highlight draw           | `frontend/src/components/TilePlacementCanvas.tsx` | ~140–180             |
| Context menu trigger (right-click) | `frontend/src/components/TilePlacementCanvas.tsx` | search `contextmenu` |
| Inspector blur-to-apply pattern    | `frontend/src/components/TileInspector.tsx`       | 65–90                |
| Page-level data loading + refresh  | `frontend/src/components/MapEditorPage.tsx`       | 50–120               |
