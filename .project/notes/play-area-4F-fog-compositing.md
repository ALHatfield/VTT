# Play Area — Fog of War Compositing (PixiJS v8)

## The Problem

`blendMode = 'erase'` on a PixiJS v8 `Graphics` object does NOT erase only from
sibling objects. It erases from the **accumulated WebGL scene buffer** — i.e.,
everything that has already been drawn to the main render target before that
Graphics runs. This means a fog cutout erases the map and tokens underneath the
fog layer, producing a **dark/black circle** instead of a transparent reveal.

## What Doesn't Work

| Approach | Why it fails |
|---|---|
| Sibling `Graphics` with `blendMode='erase'` | Erases from the main scene buffer, not just from `fogOverlay` |
| `isRenderGroup = true` on the fog container | `isRenderGroup` is a **batching optimization** only — it does NOT create an isolated render texture. Erase still hits the main buffer. |
| `Graphics.mask` + `.cut()` on a mask shape | `.cut()` correctly punches a hole in the mask shape but the result was not composited correctly against the fog — revealed areas still appeared dark in testing |
| Even-odd winding via `fillRule: 'evenodd'` | Not a valid property in PixiJS v8's `fill()` API (TypeScript error) |

## What Works: AlphaFilter Isolation

Applying **any Filter** to a container forces PixiJS to render that container
into its **own isolated render texture** before compositing to the main scene.
`AlphaFilter({ alpha: 1 })` is a no-op visually but triggers this isolation.

```typescript
this.fogContainer = new Container();
this.fogContainer.filters = [new AlphaFilter({ alpha: 1 })];

// Inside fogContainer:
//   fogOverlay  — solid dark rect (the fog)
//   fogCutouts  — blendMode='erase', draws revealed polygons + circles

this.fogContainer.addChild(this.fogOverlay);
this.fogContainer.addChild(this.fogCutouts);
```

**Why this works:** `fogCutouts` with `blendMode='erase'` now erases only from
`fogOverlay` pixels within the container's isolated texture. The transparent
holes are preserved when `fogContainer`'s texture is composited back to the main
scene, revealing the Background + Playground layers underneath.

## Debugging Strategy That Found the Fix

When a compositing effect is wrong, test each layer independently:

1. **Disable fog entirely** → verify base scene (tokens, map) renders correctly
2. **Enable fog only** → verify overlay covers the scene correctly
3. **Show vision circles as colored fills (no fog)** → verify position/radius is correct
4. **Combine** → if it fails here, the bug is compositing-specific

Steps 1–3 confirmed the data (positions, sizes) and individual effects were
correct. The bug was only in combining them, which pointed squarely at the
WebGL compositing/blend mode isolation issue.

## Implementation in ForegroundLayer

```
ForegroundLayer (Container)
  ├── fogContainer (Container, filters=[AlphaFilter(1)])  ← isolated texture
  │     ├── fogOverlay   (Graphics)  — full-map dark rect
  │     └── fogCutouts   (Graphics, blendMode='erase')
  │           — fog region polygons (DM-drawn reveals)
  │           — vision radius circles (per-token)
  ├── fogDebug     (Graphics)  — DM view: tinted region outlines only
  └── brushPreview (Graphics)  — DM fog brush preview
```

## Key PixiJS v8 API Notes

- `blendMode = 'erase'` — removes alpha from pixels already in the current render target
- `filters = [...]` — forces the container to render to its own texture first (critical for erase isolation)
- `isRenderGroup = true` — GPU transform batching only, NOT render texture isolation
- `Graphics.cut()` — subtracts the last drawn path from the preceding fill; useful for single-shape holes but compositing with erase didn't work in this scenario
- `AlphaFilter` is exported from `pixi.js` directly — add to vi.mock return when mocking pixi.js in tests

## Test Mock Note

Any test file that mocks `pixi.js` and covers code that uses `AlphaFilter` must
include it in the mock return:

```typescript
class MockAlphaFilter {
  alpha = 1;
  constructor(_opts?: { alpha?: number }) {}
}

return {
  Container: MockContainer,
  Graphics: MockGraphics,
  AlphaFilter: MockAlphaFilter,
  // ...
};
```
