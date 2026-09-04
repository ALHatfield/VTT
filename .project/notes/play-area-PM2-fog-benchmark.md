# play-area PM2 — Fog Mask Benchmark Checklist

Manual performance pass for the PM2 RenderTexture fog pipeline.

## Targets

- 60 FPS with 20+ simultaneous reveal sources on a standard encounter map
- Mask recomposition under 2 ms during typical token movement

## Instrumentation

`CanvasManager.getFogCompositionMs()` returns the duration of the most recent
mask recomposition (both textures). Sample it by adding a temporary effect in
`PlayArea.tsx`:

```ts
useEffect(() => {
  if (!canvasManager) return;
  const id = setInterval(() => console.log(canvasManager.getFogCompositionMs()), 1000);
  return () => clearInterval(id);
}, [canvasManager]);
```

Frame rate: Chrome DevTools → Performance → record 10 s while dragging a token.

## Matrix

Run each row as DM with **Player view** enabled so fog actually renders.

| Map size             | Reveal sources | Edge softness | Mask quality | FPS | Composition ms |
| -------------------- | -------------- | ------------- | ------------ | --- | -------------- |
| Small (1024×1024)    | 1              | off           | 50%          |     |                |
| Standard (2048×2048) | 10             | off           | 50%          |     |                |
| Standard (2048×2048) | 20             | off           | 50%          |     |                |
| Standard (2048×2048) | 20             | radial        | 50%          |     |                |
| Standard (2048×2048) | 20             | filter        | 50%          |     |                |
| Standard (2048×2048) | 40             | off           | 25%          |     |                |
| Large (4096×4096)    | 20             | off           | 25%          |     |                |
| Large (4096×4096)    | 20             | off           | 100%         |     |                |

## Compatibility checks

- [ ] `fogMode: legacy` renders identically to the Phase 4F baseline
- [ ] Switching `legacy ↔ pm2` at runtime does not leak textures (check DevTools memory)
- [ ] Persistent exploration survives a page reload (REST rehydrate)
- [ ] Persistent exploration survives a socket reconnect
- [ ] Observers never receive exploration stamps
- [ ] Pan and zoom keep reveals pinned to world coordinates

## Rollback

Set the scene renderer back to **Legacy polygons** in the DM fog panel. No data
is lost — exploration rows remain and are re-applied when PM2 is re-enabled.
