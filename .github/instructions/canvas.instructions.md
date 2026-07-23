---
description: "Conventions for PixiJS canvas rendering, layer management, and token system."
applyTo: "**/features/play-area/**,**/features/editor/**"
---
# Canvas Conventions (PixiJS)

## Layer Architecture
The canvas uses three main PixiJS Containers as layers, rendered in order:
1. **BackgroundLayer**: Static map/tile images — lowest z-index
2. **PlaygroundLayer**: Grid overlay and interactive tokens (player, monster, NPC, misc)
3. **ForegroundLayer**: Fog of war, weather effects, lighting overlays — highest z-index

Each layer is a class extending `PIXI.Container`, managed by a central `CanvasManager`.

## Container Hierarchy
```
Stage (PIXI.Application.stage)
├── BackgroundLayer (Container)
│   └── MapTiles(s)
├── PlaygroundLayer (Container)
│   ├── GridOverlay
│   └── TokenContainer
│       ├── PlayerToken(s)
│       ├── MonsterToken(s)
│       └── NPCToken(s)
└── ForegroundLayer (Container)
    ├── FogOfWar
    ├── WeatherEffects
    ├── SpecialEffects
    └── LightingOverlay
```

## Token System
- Tokens are interactive sprites with drag-and-drop behavior
- Token position is grid-snapped: convert pixel coords to grid coords using the grid cell size
- Token movement sends intents to the server via Socket.IO — the server validates and broadcasts the new position
- Only the owning player (or DM) can move a token — enforce client-side and server-side

## Performance
- Destroy sprites and textures when removing them from the canvas — avoid memory leaks
- Use `PIXI.Ticker` for animation loops, not `requestAnimationFrame` directly
- Batch texture loading with `PIXI.Assets` loader
- Set `eventMode = 'static'` on interactive elements, `'none'` on non-interactive ones to reduce hit-testing overhead

## Integration with React
- Mount PixiJS `Application` inside a React component using a ref to the container div
- Use a custom hook (`useCanvas`) to manage the PixiJS lifecycle (init, resize, destroy)
- Canvas state (token positions, layer visibility) syncs through Socket.IO, not React state
- React UI overlays (turn tracker, dice roller, chat) are HTML elements positioned over the canvas, not rendered inside PixiJS
