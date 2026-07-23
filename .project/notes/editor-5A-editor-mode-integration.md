# editor: Editor Mode Integration

**Created:** 2026-06-10
**Affects:** editor feature, play-area feature

## Covers

- `5A` in `.project/features/editor.md`
- Touches play-area UI layout (campaign toolbar, canvas toolbar, chat box, dice roller)

## Purpose

Defines how the editor is accessed and experienced — not as a separate page, but as a **mode toggle** within the play-area view. This keeps the DM's workflow in one place and avoids duplicating the canvas infrastructure.

## Editor as a Mode, Not a Route

The editor is **not** a separate route or page. It lives inside the play-area as a togglable mode:

- The **campaign toolbar** (top bar — campaign notes, inventory, etc.) gains an **"Editor"** button, visible only to the DM.
- Clicking "Editor" switches the play-area into **editor mode**.
- In editor mode, a **"Back to Play Area"** button replaces the "Editor" button in the same toolbar position, allowing the DM to revert.

This means the play-area component tree needs a mode state (`'play' | 'editor'`) that controls which UI panels are rendered.

## UI Swap on Mode Toggle

When switching between modes, entire UI regions swap out:

| UI Element | Play Mode | Editor Mode |
|---|---|---|
| Campaign toolbar (top) | Visible | Visible (with "Back to Play Area" button) |
| Canvas toolbar (left, Phase 4F.3) | Visible | Hidden |
| Chat box (Phase 4D) | Visible | Hidden |
| Dice roller | Visible | Hidden |
| Asset library (Phase 5A) | Hidden | Visible |
| Layer management panel (Phase 5C) | Hidden | Visible |

The PixiJS canvas itself **remains mounted** — it doesn't unmount/remount. Only the interaction handlers and surrounding UI change.

## Mode-Aware Component Labels

To keep the codebase clear about which UI belongs where, adopt a convention:

- Components exclusive to play mode live in `features/play-area/components/`
- Components exclusive to editor mode live in `features/editor/components/`
- The mode toggle logic and shared layout live in the play-area feature (since it owns the overall view)

The play-area's top-level component conditionally renders panels based on mode:

```tsx
// Conceptual structure — not final API
const PlayArea = () => {
  const [mode, setMode] = useState<'play' | 'editor'>('play');

  return (
    <div className={styles.playArea}>
      <CampaignToolbar mode={mode} onToggleMode={setMode} />
      <CanvasViewport />
      {mode === 'play' && (
        <>
          <CanvasToolbar />
          <ChatBox />
          <DiceRoller />
        </>
      )}
      {mode === 'editor' && (
        <>
          <AssetLibrary />
          <LayerManagement />
        </>
      )}
    </div>
  );
};
```

## Canvas Behavior Differences

The canvas stays mounted across mode switches, but interaction handlers should differ:

- **Play mode:** Token drag/move, fog-of-war interaction, measurement tools, etc.
- **Editor mode:** Tile placement (drag from asset library), tile selection/resize/rotate, grid snapping, layer reordering.

This suggests the canvas interaction layer reads the current mode and delegates to the appropriate handler set. The `CanvasManager` (or a wrapper) should accept a mode prop or subscribe to mode context.

## Access Control

- Only users with the `dm` role see the "Editor" button.
- Editor API routes (asset upload, tile CRUD) already require `dm` role per the feature doc.
- Players and Observers are unaffected — they never see the toggle and can't enter editor mode.

## Open Questions

- Should the editor mode be indicated visually on the canvas itself (e.g., subtle border/overlay, "EDITING" badge) so the DM always knows which mode they're in?
- When the DM is in editor mode, do other players see changes live, or only after the DM "publishes" / exits editor mode?
- Should there be an intermediate "preview" state where the DM can see the scene as players would see it before leaving editor mode?

---

## Map Sizing & Grid Alignment (Roll20 Reference)

**Added:** 2026-06-10
**Source:** [Roll20 — Sizing and Aligning Maps](https://help.roll20.net/hc/en-us/articles/360039243994-Sizing-and-Aligning-Maps)

Roll20 has several map alignment features worth adapting for VTT's editor. These mostly touch Phase 5E (Grid Alignment Detection) but the UX lives in the editor mode UI (5A/5B).

### Smart Sizing (Auto-Fit Page to Map)

When a map image is dropped onto an empty map layer, Roll20 prompts the DM to resize the page dimensions to match the image. Key behaviors:

- Only triggers on a **blank map layer** (not when other assets exist)
- Only works if the map is **larger** than the current page size
- Works better with **gridless** map images (pre-gridded maps need manual alignment)
- Can be disabled via a "Don't show me again" toggle in settings

**VTT adaptation:** When the DM drops a background asset onto an empty BackgroundLayer, offer a prompt: *"Resize canvas to match this image?"* This auto-sets the scene dimensions and avoids the most common alignment headache. Store the user's preference for auto-prompting in campaign settings.

### Align to Grid Tool

Roll20's main alignment workflow for pre-gridded maps:

1. Zoom to 150% for precision
2. Right-click map → Advanced → **Align to Grid**
3. **Trace a 3×3 section** of the map's built-in grid (click-and-drag a rectangle covering 3 columns × 3 rows)
4. System calculates the grid spacing from the traced area and scales the map to match Roll20's grid
5. Fine-tune with horizontal/vertical scale handles and Alt+drag repositioning

**VTT adaptation:** This maps directly to Phase 5E's grid alignment detection, but instead of (or in addition to) automated Canny/Sobel edge detection, offer a **manual trace mode**:

- DM activates "Align to Grid" from a context menu or toolbar on a **specific tile**
- DM draws a rectangle over a 3×3 grid section on that tile's built-in grid
- System calculates: `gridSpacing = tracedWidth / 3` (or `tracedHeight / 3`)
- System **resizes the tile image** so `gridSpacing` matches `canvasGridSize`
- Show scale handles for fine-tuning after the initial alignment

**Important:** The canvas grid is fixed — alignment always resizes the **tile asset**, never the canvas. Multiple tile assets will coexist on the same canvas (e.g., a dungeon map background + furniture overlays + wall segments), each potentially with different source grid sizes. Each tile gets aligned independently to the shared canvas grid.

This manual trace is simpler to implement than edge detection and covers more map styles (hand-drawn grids, hex grids, partially-gridded maps). Edge detection (5E) becomes an enhancement that auto-traces for the user.

### Set Dimensions (Manual Pixel Control)

Roll20 lets the DM right-click → Set Dimensions to enter exact pixel width/height. Used for:

- Fine-tuning after Align to Grid gets close but not perfect
- Maps with known pixel-per-cell ratios (e.g., 64×64 pixel cells)
- Adapting between different grid pixel standards

**VTT adaptation:** The Tile Inspector (Phase 5C) should include width/height fields with pixel-level precision. Already planned — this confirms the need for exact dimension input, not just drag-handle resizing.

### Grid Pixel Adaptation (Known Dimensions)

When the DM knows the map's pixels-per-cell (e.g., 64px), Roll20's workflow:

1. Set image dimensions to `gridCells × pixelsPerCell` (e.g., 50×64 = 3200px wide)
2. Calculate grid unit size: `pixelsPerCell / 70` (Roll20's standard is 70px/cell)
3. Adjust scale accordingly

**VTT adaptation:** Add a field in the asset upload or tile inspector: **"Grid cell size (px)"**. If the DM enters a value (e.g., 64), the system auto-calculates the scale factor: `canvasGridSize / assetGridSize`. This is a simpler UX than Roll20's manual math — we can do the calculation for them.

### Alt+Drag for Sub-Grid Positioning

Roll20 uses Alt+drag to bypass grid snapping and position maps with sub-grid precision. Essential for final alignment tweaks.

**VTT adaptation:** Hold a modifier key (Alt or a configurable key) to temporarily disable grid snapping during tile drag. Already implied by Phase 5B's grid snapping task — ensure the bypass modifier is implemented alongside snapping.

### Hex Grid Alignment

Roll20 supports hex grid alignment with a different workflow (find map center, align from midpoint outward). Relevant if VTT supports hex grids.

**VTT adaptation:** Defer hex grid support unless the roadmap calls for it. Note that the 3×3 trace approach doesn't cleanly map to hex — hex alignment would need a separate trace pattern (e.g., trace a known number of hex rows/columns).
