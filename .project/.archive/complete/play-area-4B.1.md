# Play Area — Phase 4B.1: Token Card & Movement Polish

**Completed:** 2026-05-31
**Feature:** `play-area`

## Deliverables

### client/
- `client/src/features/play-area/canvas/TokenSprite.ts` (MODIFIED) — token stays at origin during drag; blue snap-highlight + ghost circle + glow ring + dashed line preview; `globalpointermove` listener so tracking works after cursor leaves hit area; `onTokenDragStart` callback fires at threshold crossing; ESC key cancellation via `window.addEventListener('keydown')`; `pendingDropX/Y` for drop tween target; mid-drag destroy cleanup; child render order: snapHighlight → dragLine → selectionRing → circle → ghostIndicator → nameLabel
- `client/src/features/play-area/canvas/PlaygroundLayer.ts` (MODIFIED) — `onTokenDragStart: TokenDragStartCallback` parameter added to `addToken()` and `setTokens()`
- `client/src/features/play-area/canvas/CanvasManager.ts` (MODIFIED) — `onTokenDragStart?: () => void` callback wired through `setTokens()`; background-click guard replaced with pixel-distance threshold (4 px) instead of boolean movement flag; removed `pointermove` stage listener
- `client/src/features/play-area/PlayArea.tsx` (MODIFIED) — `onTokenDragStart` clears hover/selection on drag start; hover suppressed while `selectedTokenId !== null` OR `isDraggingToken`; `onTokenClick` side effect moved outside React state updater
- `client/src/features/play-area/canvas/TokenSprite.test.ts` (MODIFIED) — all `pointermove` emits updated to `globalpointermove`; 5 new tests: token position unchanged during drag, `onTokenDragStart` fires once at threshold, not on click, snap-highlight/dragLine become visible, ESC cancels drag
- `client/src/features/play-area/canvas/CanvasManager.test.ts` (MODIFIED) — background-click tests updated to pass `{ global: { x, y } }` event objects; replaced `pointermove` test with micro-jitter test (< 4 px still counts as click) and pan test (≥ 4 px suppresses click)

## Test Results

```
npx vitest run --project client

 ✓  client  src/features/play-area/canvas/grid-utils.test.ts          (8 tests)
 ✓  client  src/features/play-area/canvas/viewport-culling.test.ts   (19 tests)
 ✓  client  src/features/play-area/canvas/TokenSprite.test.ts        (14 tests)
 ✓  client  src/features/play-area/canvas/CanvasManager.test.ts      (13 tests)
 ✓  client  src/features/play-area/components/TokenHoverCard.test.tsx (18 tests)
 ✓  client  src/features/auth/Login.test.tsx                          (4 tests)
 ✓  client  src/features/auth/ProtectedRoute.test.tsx                 (3 tests)
 ✓  client  src/features/portal/Welcome.test.tsx                      (5 tests)
 ✓  client  src/features/portal/PortalLayout.test.tsx                (10 tests)
 ✓  client  src/shared/components/ErrorBoundary.test.tsx              (3 tests)

 Test Files  10 passed (10)
      Tests  97 passed (97)
```

## Decisions & Insights

- **`globalpointermove` is required for ghost-drag UX in PixiJS.** When the token stays at origin and the cursor moves away, `pointermove` stops firing (it only fires when the cursor is over the hit area). `globalpointermove` fires on every interactive object for every pointer movement, so drag tracking continues correctly across the whole canvas.

- **Background click threshold vs. boolean flag.** The original `backgroundDragMoved` boolean was set by `any` `pointermove` event, which fires on micro mouse-jitter during normal clicks. Replacing it with a pixel-distance check (same 4 px as the drag threshold) means real clicks always register.

- **PP ghost-drag pattern.** Token stays at `originX/originY`; all preview graphics (`snapHighlight`, `dragLine`, `ghostIndicator`) are positioned at `relX = pendingDropX - originX`, `relY = pendingDropY - originY`. Drop tween animates `this.x/y` from origin to `pendingDropX/Y` on pointerup.

- **`onTokenDragStart` fires at threshold crossing, not on pointerdown.** This matches PP and ensures the selection card is cleared at the moment the user's intent becomes unambiguous, not prematurely on every pointer press.

- **Hover suppression during drag.** After `onTokenDragStart` clears `selectedTokenId`, a secondary guard `canvasManager.isDraggingToken` prevents hover cards from appearing while the drag is in progress. Both guards are needed: `selectedTokenId` for the "selected token" case, `isDraggingToken` for the "no token was selected, but we're mid-drag" case.

## Dependencies Unlocked

- `play-area 4C` (Real-Time Sync) — now unblocked; 4B.1 was the final polish phase before moving to real-time
