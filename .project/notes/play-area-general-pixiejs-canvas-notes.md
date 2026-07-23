# PixiJS Canvas Notes

This note is now the index for the advanced PixiJS canvas work planned after MVP.

## MVP Boundary

Phase 4F covers the baseline fog-of-war slice needed for MVP:
- DM drawing tools on `ForegroundLayer`
- revealed region persistence per scene
- player-safe fog delivery and DM-only editing
- real-time fog reveal and hide updates

The material that used to live in this file mostly goes beyond that scope. It is now split into post-MVP implementation guides.

## Post-MVP Phase Map

- `PM2` - Optimized fog rendering: [.project/notes/play-area-fog-rendering.md](c:/Users/Hatty/Desktop/VTT-2/.project/notes/play-area-fog-rendering.md)
- `PM3` - Line of sight and obstacle-aware visibility: [.project/notes/play-area-line-of-sight.md](c:/Users/Hatty/Desktop/VTT-2/.project/notes/play-area-line-of-sight.md)
- `PM4` - Dynamic light emitters and flicker effects: [.project/notes/play-area-lighting-effects.md](c:/Users/Hatty/Desktop/VTT-2/.project/notes/play-area-lighting-effects.md)
- `PM5` - Weather and environmental effects: [.project/notes/play-area-environmental-effects.md](c:/Users/Hatty/Desktop/VTT-2/.project/notes/play-area-environmental-effects.md)
- `PM6` - Final integration and atmosphere polish: tracked here and in the feature doc as the combined rendering pass

## Core Integration Pattern

The key architectural relationship for the advanced canvas stack is:

1. CPU-side geometry work computes visibility or lighting polygons when obstacles matter.
2. GPU-side `RenderTexture` masking and batched compositing render those polygons efficiently on the canvas.
3. Lighting, fog, and atmosphere effects should build on one shared layer ordering model rather than each inventing a separate overlay system.

## What Stays Here

Keep this file as the entry point for the advanced PixiJS canvas track:
- links to the focused implementation notes
- the MVP versus post-MVP scope boundary
- high-level integration guidance across PM2-PM6

Do not turn this file back into a mixed code dump. Detailed algorithms, examples, and performance notes belong in the focused files.