---
description: "Play area feature — canvas rendering, tokens, dice, chat, fog of war, and real-time sync."
applyTo: "**/features/play-area/**"
---
# Feature: play-area

> For current phase status and tasks, see `.project/features/play-area.md`

This is the largest feature area. It contains the live game canvas and all real-time gameplay systems.

## Sub-Features
1. **Canvas & Map Rendering** — PixiJS layered canvas with map images and grid
2. **Token System** — Interactive tokens with drag-and-drop, health, and status tracking
3. **Dice Roller** — Hosted here, owned by the `dice` feature (see `feature-dice.instructions.md`)
4. **Chat System** — Real-time messaging with dice command parsing
5. **Fog of War** — DM-controlled visibility masking for players
6. **Initiative & Turn Tracker** — Combat order management sidebar

## Canvas Architecture (PixiJS)
Four-layer system rendered in order:
1. **BackgroundLayer** (`PIXI.Container`): Map/tile images, static
2. **LightLayer** (`PIXI.Container`, PM4): Additive light glow + embers
3. **PlaygroundLayer** (`PIXI.Container`): Grid overlay + interactive tokens
4. **ForegroundLayer** (`PIXI.Container`): Fog of war, weather effects

Central `CanvasManager` class owns the `PIXI.Application` and manages all layers. Mount via React ref + `useCanvas()` hook.

## Token System
- Token types: player, monster, NPC, misc — each with different permission rules
- Players can only move their own token; DM can move any token
- Movement: client sends `token:move` intent → server validates position → broadcasts `token:moved`
- Grid snapping: pixel coords → grid coords using `gridCellSize`
- Token data: name, HP, AC, status effects, portrait image, linked character ID

## Real-Time Sync (Socket.IO)
- All play area state changes go through Socket.IO, not REST
- Campaign room: `campaign:{campaignId}` — all members join on connection
- Event flow: client intent → server validation → broadcast to room
- Key events: `token:move/moved`, `chat:send/received`, `fog:reveal/revealed` (dice rolls use the dice-owned `dice:roll` intent)
- 100ms debouncing for token drag movements
- Event queuing during disconnection with replay on reconnect

## Dice Roller
Dice rules, roll visibility, macros, history, and 3D rendering are owned by the `dice` feature — see `feature-dice.instructions.md` and `.project/features/dice.md`. All dice code lives in `features/dice/` (client and server) and `shared/src/{types,constants,validators}/dice.ts`. `PlayArea.tsx` composes `DiceOverlay`, `DiceRollerButton`, `useDiceSettings`, and `use3dDiceReveal` from `../dice/`; play area persists roll results as `roll` chat messages. Never add dice code under `play-area/`.

## Chat System
- Messages persisted to `campaign_messages` table
- Message types: text, dice_roll, system (join/leave notifications)
- Real-time via Socket.IO; historical messages loaded via REST on join
- Dice commands parsed from chat input, executed server-side, result posted as dice_roll message

## Fog of War
- DM draws fog regions on the ForegroundLayer
- Players see fog as opaque overlay — hidden areas are not rendered (not just visually hidden)
- DM can reveal/hide regions; changes broadcast via `fog:reveal` / `fog:hide`
- Fog state persisted per map

## Initiative & Turn Tracker
- DM initiates combat → prompts all players to "roll for initiative"
- Character sheet integration: auto-populates initiative modifier
- Turn order sidebar displays sorted initiative list
- DM advances turns; active token highlighted on canvas

## Prior Art (Project_Pathfinder)
- MapViewer component (1000+ lines, refactored into 4 hooks)
- `useMapGridConfig` — grid state, pan/zoom, viewport management
- `useTokenSelection` — hover/select state, token card positioning
- `useCharacterLinking` — character-token linking modal
- `useMapCalibration` — magic wand grid calibration tool
- Token drag-to-move with optimistic updates + server confirmation
- Chat with message persistence and emoji support
- WebSocket hooks with auto-reconnection and event queuing
- 60 FPS canvas rendering with viewport culling for 1000+ tiles

## Performance Targets
- 60 FPS during token dragging and map panning
- < 200ms latency for token move round-trip (client → server → broadcast)
- Viewport culling: only render sprites within the visible area
- Texture pooling: reuse textures for identical token/tile types
