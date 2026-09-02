# Feature: play-area — Phase 4F.3: Canvas Toolbar Shell & Navigation

**Completed:** August 30, 2026
**Feature:** `play-area`

## Deliverables

**New — client**

- `client/src/features/play-area/hooks/useToolMode.ts` — `ToolMode` state hook; re-exports type from CanvasManager
- `client/src/features/play-area/hooks/useToolMode.test.ts` — 4 tests
- `client/src/features/play-area/components/CampaignToolbar.tsx` — renamed from PlayAreaToolbar; navigation + fog controls (fog migrates in 4F.4)
- `client/src/features/play-area/components/CampaignToolbar.module.css`
- `client/src/features/play-area/components/CanvasToolbar.tsx` — vertical canvas tool strip with role-gated Select/Pan buttons
- `client/src/features/play-area/components/CanvasToolbar.module.css`
- `client/src/features/play-area/components/CanvasToolbar.test.tsx` — 5 tests

**Modified — client**

- `client/src/features/play-area/canvas/CanvasManager.ts` — added `ToolMode` type, `setToolMode()`, right-click-drag pan, play-mode rubber-band token selection (`onTokensSelected`), `setTokensSelected()`
- `client/src/features/play-area/canvas/CanvasManager.test.ts` — 10 new tests; updated 1 test to reflect new play-mode marquee behavior
- `client/src/features/play-area/canvas/PlaygroundLayer.ts` — added `iterateTokens()` for rubber-band hit-testing
- `client/src/features/play-area/canvas/TokenSprite.ts` — added `getTokenBounds()` for rubber-band hit-testing; fixed mock events in tests (`button: 0`)
- `client/src/features/play-area/canvas/TokenSprite.test.ts` — added `button: 0` to 5 mock pointerdown events (pre-existing failures from uncommitted prior phase)
- `client/src/features/play-area/PlayArea.tsx` — integrated `CampaignToolbar`, `CanvasToolbar`, `useToolMode`; pan overlay; zoom buttons; fog/pan interlock effect
- `client/src/features/play-area/PlayArea.module.css` — added `.panOverlay`, `.zoomButtons`, `.zoomBtn`

## Test Results

```
npx vitest run --reporter=verbose
Test Files  40 passed (40)
Tests  547 passed (547)
```

New tests added this phase: 19 (useToolMode × 4, CanvasToolbar × 5, CanvasManager tool mode + rubber-band × 10)

## Decisions & Insights

- **`ToolMode` ownership:** Type lives in `CanvasManager.ts` (pure canvas class) and is re-exported from `useToolMode.ts`. Avoids structural duplication where adding a new tool mode to one file wouldn't flag an error in the other.
- **Pan overlay pattern:** Left-click pan in Pan mode is a React `<div>` overlay (same pattern as fog draw overlay) rather than a CanvasManager-internal behavior. Keeps React event handling in React; CanvasManager only handles middle-mouse and right-click pan natively.
- **Fog/Pan interlock:** Activating Pan tool fires a `useEffect` that clears fog draw mode. Both overlays share `z-index: 8` — without this, the pan overlay would swallow all fog drawing pointer events.
- **Rubber-band respects `canInteract`:** `commitTokenMarqueeSelection` filters to `sprite.canInteract === true`, consistent with single-click selection. Players can't rubber-band-select enemy tokens.
- **Pre-existing TokenSprite test failures:** The `event.button !== 0` guard added in a prior uncommitted phase broke 5 `TokenSprite.test.ts` tests. Fixed by adding `button: 0` to mock `pointerdown` events. This was the correct fix — these tests were asserting drag behavior that requires a left-click.
- **Phase:verify glob issue on Windows:** The `--slug` filter in `npm run phase:verify` sends `**/features/play-area/**` to vitest, which never matches on this Windows workspace setup. Workaround: run `npx vitest run "client/src/features/play-area"` directly.

## Dependencies Unlocked

- **Phase 4F.4** (Fog of War Toolbar Integration) — now has the `CanvasToolbar` shell to integrate fog tools into
- **Phase 4F.5** (NPC Token Placement Tool) — depends on toolbar shell
- **Phase 4H** (Initiative & Turn Tracker) — depends on toolbar shell for toggle button
- **Phase 4J** (Measure Tool & Player Color) — depends on toolbar shell
- **Phase 4K** (Drawing Tools) — depends on toolbar shell
