# play-area: Lighting Effects

## Covers

- `PM4` in [.project/features/play-area.md](c:/Users/Hatty/Desktop/VTT-2/.project/features/play-area.md)
- dynamic ambient and authored light emitters for the PixiJS canvas

## Purpose

Add real-time light emitters such as torches, fireplaces, lanterns, or magical glows that make scenes feel alive while staying compatible with the fog and LOS pipeline.

## PixiJS Patterns Used

- additive blend sprites or textures for warm or cold light falloff
- animated scale, alpha, or intensity changes for flicker
- optional clipping via obstacle-aware geometry once `PM3` exists
- secondary particle embellishments such as embers for fireplace-style sources

## Implementation Outline

### 1. Light Emitters

- define authored scene lights with position, radius, color, falloff, and animation mode
- support both persistent scene lights and temporary DM-placed lights if live tooling is needed

### 2. Flicker Animation

- use layered sine-based or noise-like modulation so the effect does not repeat mechanically
- keep the animation deterministic enough for multiplayer synchronization rules

### 3. Warm Glow Layer

- treat lighting as more than visibility clearing
- render a tinted additive glow layer above the map to create warmth without replacing the fog mask itself

### 4. Wall-Aware Clipping

- once `PM3` exists, clip light sprites or polygons against obstacle-aware geometry so light does not bleed through hard walls

## Performance Considerations

- avoid unique per-light render paths when a batched or shared-texture approach works
- benchmark both the visibility-clearing side and the additive glow side together
- verify that decorative embellishments such as embers remain optional under reduced-performance settings

## Open Questions

- which light properties must be authoritative on the server versus client-animated?
- should all light placement be editor-authored, or can DMs place encounter-time lights live?

## Roll20 Dynamic Lighting — Player-Facing Reference

Source: [Using Dynamic Lighting As A Player](https://help.roll20.net/hc/en-us/articles/11786989363479-Using-Dynamic-Lighting-As-A-Player)

### Vision Types (per-token settings, GM-controlled)

- **Update On Token Drop** — vision only recalculates when the token is released, not while dragging. Useful for high-stakes movement where the GM wants commitment before reveal.
- **Nightvision** — token can see in total darkness. Maps to darkvision / low-light vision racial traits.
- **Nocturnal Vision** — mimics D&D 5e / PF2e darkvision rules: no-light areas appear as low light, low-light areas appear brightly lit.

### Lighting Types (scene-level settings, GM-controlled)

- **Explorer Mode** — previously visited areas remain visible in greyscale after the token moves away; without it, unseen areas are pure black. Equivalent to "revealed fog" in our fog system.
- **Permanent Darkness** — areas that stay dark regardless of token vision until the GM manually removes them. Useful for magical darkness or story-gated reveals.

### Interactive Elements

- **Doors & Windows** — players can left-click to open/close. Open doors and windows allow both movement and light/vision to pass through.

### Design Takeaways for VTT

- Token vision settings (nightvision, nocturnal, update-on-drop) should be per-token properties the DM configures, not global scene settings.
- Explorer mode (greyscale reveal of previously seen areas) is a scene-level toggle that interacts with our fog pipeline — decide whether `PM4` or `PM6` owns this.
- Permanent darkness as a first-class light-blocker type gives DMs a narrative tool beyond wall geometry.
- Door/window interactivity ties lighting to the obstacle system from `PM3` — doors toggle wall segments for both collision and light/LOS.
- Performance note from Roll20: hardware acceleration is critical; explorer mode is the most expensive option. Budget accordingly.

## Relationship To Later Phases

- `PM6` merges lights with fog, LOS, and atmosphere into one final scene stack
- weather from `PM5` must not visually overpower lights or erase readability around tokens