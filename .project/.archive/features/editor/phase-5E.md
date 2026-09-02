# Archived Phase 5E: Grid Alignment Tool

- Feature: `editor`
- Source: `.project/features/editor.md`
- Archived: 2026-08-29

---

## Phase 5E: Grid Alignment Tool

**Dependencies:** Phase 5B

### Tasks

- [x] "Align to Grid" action in tile context menu / toolbar
- [x] Manual trace mode: DM draws a rectangle over a 3×3 grid section on the tile; system calculates `gridSpacing = tracedWidth / 3`
- [x] System resizes the tile so `gridSpacing` matches `canvasGridSize`
- [x] Scale handles for fine-tuning after initial alignment
- [x] Aspect ratio lock toggle during fine-tune
- [x] Live canvas preview during adjustment
- [x] Auto-detection enhancement: Canny/Sobel edge detection to auto-trace for the user
- [x] Fallback UX: "Grid detection failed. Please adjust manually." (falls back to manual trace)
- [x] Shared types: `GridAlignmentResult`, `GridDetectionConfig`
- [x] Tests: manual trace calculation, auto-detection accuracy, tile resize (never canvas), fallback behavior

### Decisions

- **Manual trace is primary**, auto-detection is secondary — manual trace covers more map styles (hand-drawn, hex, partial grids) and is simpler to implement
- Alignment always resizes the **tile asset**, never the canvas grid — multiple tiles with different source grid sizes coexist on the same canvas
- Performance target for auto-detection: <500ms per image, 80%+ accuracy on standard grid maps
- **`detectGridSpacing` injectable `loadFn` parameter** — the async image-loading step is injected as a default-parameter so tests can supply synthetic `ImageData` without real canvas rendering
- **`config.cellsAcross` / `config.cellsDown` used to cap the period search range** — prevents detecting spurious large periods that span fewer cells than the user specified
- **Fine-tune is a slider (50%–200%) with separate W/H inputs and an aspect-ratio lock** — covers the spec's "scale handles" and "lock toggle" requirements in a clean React form

---


