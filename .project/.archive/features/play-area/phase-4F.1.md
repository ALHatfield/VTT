# Archived Phase 4F.1: Token Vision Reveals

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-06-06

---

## Phase 4F.1: Token Vision Reveals

**Dependencies:** Phase 4F, Phase 4G

### Tasks
- [x] Add `visionRadius` integer field to Prisma `Token` model (default: 6 grid cells)
- [x] Migrate and seed: set visionRadius=6 on all existing tokens
- [x] Add `TokenVisionReveal` to shared types — `{ tokenId, x, y, visionRadius, sceneId }`
- [x] Add `play-area:token:vision:sync` Socket.IO event to shared constants
- [x] Server fog service: `computeTokenVisionRegions(sceneId)` — returns dynamic reveal circles from all token positions (not persisted; computed on demand)
- [x] Server: emit `play-area:token:vision:sync` to the room when any token moves, carrying all current token vision payloads for the scene
- [x] Client fog layer: on `play-area:token:vision:sync`, render circular reveal masks around each token position using the existing RenderTexture fog pipeline
- [x] Role-gated rendering: DM receives all token vision radii; Players receive only tokens linked to their character
- [x] Token properties panel (DM): configurable visionRadius field per token
- [x] Debounce `play-area:token:vision:sync` emit on token move — do not fire on every pixel during drag
- [x] Write tests: `computeTokenVisionRegions`, socket sync on token move, role-gated payload filtering

### Decisions
- Vision reveals are **dynamic and non-persisted** — computed from current token positions each time, not stored as FogRegion rows. Persistent exploration is post-MVP (PM2).
- Vision radius unit is **grid cells** (1 cell = 5ft by D&D convention). Default 6 = 30ft darkvision.
- Circular reveals render into the **existing fog layer** using `AlphaFilter` isolation — `fogContainer.filters = [new AlphaFilter({ alpha: 1 })]` forces PixiJS to render to an isolated texture so `blendMode='erase'` on `fogCutouts` only erases from `fogOverlay` pixels, not the main scene buffer. See `.project/notes/play-area-fog-compositing.md` for full details.
- DM always sees through all fog regardless of token vision (enforced by 4F).
- `visionRadius` updates are DM-only server-side (enforced in `tokens.service.ts` — players cannot escalate their own radius via the REST API).

---


