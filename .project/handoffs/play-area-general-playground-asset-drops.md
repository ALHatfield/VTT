# Handoff — Play Area: Playground Asset Drops Create Tokens

**Scope:** `play-area` (general — applies to all shipped phases, not tied to a specific phase)
**Date:** 2026-07-18
**Files touched:** validators, TokenSprite, useTokens, PlayArea

---

## Problem

When a user dragged a "playground" asset (e.g. `token1.png`, `token2.png` from the Asset Library) onto the play canvas, the result was broken:

1. **Wrong size.** The image rendered at its native pixel dimensions (e.g. 200×200 px). At the default 64 px grid `cellSize`, that spanned ~3×3 cells and overflowed the grid — while real tokens like "Town Guard" and "TestPlayer1" occupied exactly 1 cell.
2. **Unclickable.** Clicking the image did nothing — no selection, no stats card, no hover.

Meanwhile, "Town Guard" and "TestPlayer1" behaved correctly (grid-sized, hoverable, selectable).

## Root Cause

Two separate systems were being conflated:

| System            | Source table             | Renderer              | Sized to                                     | Clickable in play mode?                          |
| ----------------- | ------------------------ | --------------------- | -------------------------------------------- | ------------------------------------------------ |
| **Token**         | `Token` (Prisma)         | `TokenSprite`         | `token.size * cellSize`                      | **Yes** (always)                                 |
| **TilePlacement** | `TilePlacement` (Prisma) | `TilePlacementSprite` | Native pixel `width × height` from placement | **No** (`eventMode = 'none'` unless editor mode) |

`TileAsset` records with `category: 'playground'` (seeded as `token1.png` … `token4.png`) were being placed as **TilePlacements** via the Asset Library drop flow. TilePlacements are designed as decorative sprites that only accept pointer events in the editor — hence unclickable in the play area — and always render at native size — hence 3×3 cells instead of 1×1.

Tokens ("Town Guard", "TestPlayer1") come from a completely different pipeline (created via the token API, broadcast via `TOKEN_CREATED`) and render correctly.

## Solution

Route **playground-category asset drops** into the **Token** pipeline instead of the TilePlacement pipeline, and let `TokenSprite` render the asset image as a circle-masked portrait on top of its normal colored ring / HP bar / name label / hover / drag machinery.

### Changes

1. **Validator — `shared/src/validators/play-area.ts`**
   Loosened the `iconUrl` regex on `tokenCreatePayloadSchema` and `tokenUpdatePayloadSchema` to accept root-relative paths (`/tokens/foo.png`) in addition to absolute `http(s)://` URLs. Seeded assets are served from `/tokens/…`, so the old absolute-URL-only rule rejected them.

2. **Renderer — `client/src/features/play-area/canvas/TokenSprite.ts`**
   Added optional `iconSprite` + `iconMask` layers. When `token.iconUrl` is set, the constructor calls `loadIconTexture()` which async-loads via `Assets.load(url)` and inserts a circle-masked `Sprite` directly above the colored circle (below overlays: ghost, HP bar, NPC badge, name label). The colored circle stays visible as a border ring and a fallback if the texture fails to load. A `destroyed` flag guards against the async loader touching a torn-down container. `needsRebuild()` now also compares `iconUrl` so sprite swaps trigger a rebuild.

3. **Hook — `client/src/features/play-area/hooks/useTokens.ts`**
   Added `createToken(payload: TokenCreatePayload) => Promise<Token>` that POSTs to the existing token-create route. State updates flow back through the `TOKEN_CREATED` socket broadcast (existing behavior), so no local optimistic insert is needed.

4. **Router — `client/src/features/play-area/PlayArea.tsx`**
   In the `canvasManager.onTilePlaced` handler, branch on `category`:
   - `category === 'playground'` → snap the drop position to the grid, derive a token name from the asset filename (extension stripped, capped at 60 chars), and call `createToken({ type: 'misc', size: 1, iconUrl: asset.url, x, y, name })`. Returns early — no TilePlacement is created.
   - Everything else → unchanged existing TilePlacement flow (smart-sizing prompt for oversized background tiles, otherwise `createPlacement`).

   `createToken` is added to the effect's dep list.

### Result

Dragging `token1.png`, `token2.png`, etc. onto the canvas now produces a **Token** that:

- Occupies exactly 1 grid cell (`size: 1` × `cellSize`)
- Shows the PNG as a circular portrait ringed by the token color
- Responds to hover (stats card), click (selection), and drag (grid-snapped movement)
- Behaves identically to "Town Guard" / "TestPlayer1" in every way except its `iconUrl` is set

## Follow-ups / Not Addressed

- **Ownership.** Dropped playground tokens are created without an `ownerId`. If we want DM-drops to be player-owned, add an owner picker to the drop flow (or leave unassigned and let the DM edit later).
- **Type inference.** All drops become `type: 'misc'`. If the asset filename or metadata should determine `type` (`player` / `monster` / `npc`) and `npcSubtype`, wire that into `createToken` — right now the user has to edit the token afterwards.
- **HP / AC.** Not set on drop. Consider either prompting or reading defaults from asset metadata once TileAssets support stat blocks.
- **Editor parity.** The editor still creates TilePlacements from playground assets, which is arguably wrong there too (the editor probably wants tokens as well). Left unchanged for now — flag for the editor feature owner.
- **Test coverage.** `TokenSprite.loadIconTexture` and the branching in `onTilePlaced` are not covered by unit tests. Add a Vitest case for the validator regex change and a canvas-manager integration test for the playground drop branch.
