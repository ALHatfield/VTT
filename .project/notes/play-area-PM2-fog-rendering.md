# play-area: Fog Rendering

## Covers

- `PM2` in [.project/features/play-area.md](c:/Users/Hatty/Desktop/VTT-2/.project/features/play-area.md)
- GPU-first fog rendering patterns that go beyond MVP Phase 4F

## Purpose

Upgrade the baseline fog-of-war slice from simple polygon overlays into a scalable PixiJS rendering pipeline that supports multiple reveal sources, persistent exploration, and softer visuals without pushing the heavy work onto the CPU.

## PixiJS Patterns Used

- `RenderTexture` as the fog mask target
- one dark shroud layer plus one or more mask textures
- batched vision stamps rendered through a dedicated container
- soft reveal edges via radial textures or blur filters

## Implementation Outline

### 1. Dynamic Alpha Mask Pipeline

- Render the dark shroud as a full-scene overlay in `ForegroundLayer`
- Create a `RenderTexture` for the active reveal mask
- Stamp vision sources into that texture each update instead of drawing bespoke geometry per token directly on the stage

### 2. Exploration Versus Ambient Visibility

- Use separate render targets when the game needs both:
- active line-of-sight visibility
- previously explored shroud memory
- fully hidden darkness

This should stay configurable per scene or campaign rather than being hard-coded into the renderer.

### 3. Multi-Source Batching

- Group all reveal stamps into a single container
- Render that container into the mask texture in one pass
- Avoid repeated `renderer.render()` calls inside per-unit loops whenever possible

### 4. Camera Alignment

- Keep mask coordinates synchronized with pan and zoom
- Treat the fog texture as a camera-aware rendering surface, not as a static full-screen effect

## Performance Considerations

- Prefer GPU compositing over CPU-side pixel reads or canvas image manipulation
- Benchmark mask resolution separately from scene resolution; the best quality/performance point may be lower than full-screen native resolution
- Validate batching under multiple simultaneous reveal sources, not just a single token

## Open Questions

- Should persistent exploration be controlled per campaign, per scene, or by encounter mode?
- Is the canonical soft-edge solution a radial texture stamp, a filter, or a hybrid of both?

## Relationship To Later Phases

- `PM3` uses obstacle-aware geometry to decide what gets stamped into the mask
- `PM4` can reuse the same rendering ideas for dynamic lights
- `PM6` merges the fog mask with lights and atmosphere into a final layered pipeline

---

## Roll20 Advanced Fog of War — Reference Analysis

**Added:** 2026-06-10
**Source:** [Roll20 Help — Advanced Fog of War](https://help.roll20.net/hc/en-us/articles/360037774493-Advanced-Fog-of-War)

### Core Mechanic

- Fog covers the entire page as a single opaque layer. The GM (or token movement) reveals areas to players.
- Advanced FoW divides the page into a grid of square **cells**. As a token moves, cells whose center point falls within the token's vision are revealed.
- Revealed cells stay revealed — exploration is persistent and per-token. Each player sees the union of reveals from tokens they control, giving every player a potentially unique view of the same page.

### Three Visibility States

Roll20 effectively has three visual states per cell:

1. **Hidden** — pitch black, fully fogged.
2. **Explored (previously seen)** — revealed but the token has moved away. Rendered in **desaturated colors**. NPCs/monsters in explored-but-not-currently-visible cells are hidden from the player.
3. **Active sight** — within the token's current vision radius. Full color, tokens visible.

This maps directly to the three-tier model already outlined in section 2 ("Exploration Versus Ambient Visibility") of this note.

### Two Independent Fog Layers

Roll20 runs two fog systems simultaneously:

- **Basic Fog of War** — manual GM-drawn reveal/hide regions (polygon-based).
- **Advanced Fog of War** — dynamic, token-driven cell reveals.

Each is its own composited layer. The GM can edit either layer independently (Alt = basic only, Ctrl = advanced only) or both at once. This means the GM can use basic fog to hard-block areas even if a token's vision would normally reveal them.

**Takeaway for VTT:** Consider supporting both a manual fog mask (DM-drawn polygons from PM1/4F) and a dynamic exploration mask (token-driven from PM2) as separate compositable layers in the render pipeline.

### Token Vision Configuration

- Each token can set a **View Distance** that overrides its light-emission radius for fog purposes.
- The **Dim Light Reveals** page setting controls whether the dim-light radius counts toward fog reveal or only the bright-light radius does.
- Default vision when no value is set: **2 grid units** (2×2 cell area).
- Only tokens controlled by a player reveal fog for that player. Unowned tokens can optionally reveal for the GM via a page setting.

### Cell-Based Reveal Logic

- Reveal decision is binary per cell: if the token can see the **center point** of a cell, the entire cell is revealed.
- This creates a **staircase / jagged edge** effect around diagonal walls or non-grid-aligned obstacles.
- Roll20 mitigates this by letting the GM decrease cell size (more cells = finer resolution = smaller jaggies) at the cost of performance.

**Takeaway for VTT:** Our GPU-based approach with radial texture stamps into a `RenderTexture` avoids the cell grid entirely, giving smooth reveal edges. This is a clear visual upgrade. However, we still need to decide on a persistence granularity — continuous alpha mask vs. discretized cells — for the "explored" state that gets saved to the server.

### Performance Constraints (Roll20's)

- Each token with vision has its fog state individually recorded — many tokens = more data and processing.
- Pages have a **50,000 cell cap** to prevent performance degradation.
- An "Only Update on Drop" option defers fog recalculation until a token is placed, instead of recalculating during drag.

**Takeaway for VTT:** Our `RenderTexture` stamping approach already handles continuous movement better than cell recalculation. But we should still consider a debounce or "on drop" mode for low-end clients, and think about how much per-token exploration state we persist to the server (full bitmask? simplified polygon hull?).

### Limitations Worth Avoiding

| Roll20 Limitation | Our Approach |
|---|---|
| Grid-locked cells — no partial reveals, jagged edges | GPU radial stamps give smooth, resolution-independent reveals |
| Fog reset is all-or-nothing (all tokens wiped) | Support per-token reset via server-side exploration state |
| No per-token fog isolation without keyboard shortcut | Expose per-token fog preview in the DM's UI panel |
| Desaturation is the only explored-area style | Make explored-area rendering configurable (dim, desaturated, tinted, etc.) |

### Design Decisions Reinforced

1. **Separate manual vs. dynamic fog layers** — Roll20 validates this two-layer model. Keep DM-drawn fog (from 4F) and token-driven exploration fog (PM2) as independent masks composited in the foreground layer.
2. **Per-token exploration persistence** — each token tracks its own revealed area. The player's view is the union. This is the right model for dungeon crawl scenarios.
3. **Three-state visibility** — hidden / explored / active-sight is the standard players expect. The explored state should feel visually distinct (dimmed, desaturated) without fully obscuring the map.
4. **Vision radius vs. light radius** — these should be separate token properties. A token might see farther than it illuminates (darkvision) or illuminate farther than it can see (a torch on a blind creature).