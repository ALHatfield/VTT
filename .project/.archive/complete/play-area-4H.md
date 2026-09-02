# Feature: play-area — Phase 4H: Initiative & Turn Tracker

**Completed:** September 1, 2026
**Feature:** `play-area`

## Deliverables

**Shared (`shared/src/`)**

- `constants/play-area.ts` — Added `INITIATIVE_EVENTS` for start, advance, end, reorder, and state update broadcasts.
- `types/play-area.ts` — Added initiative state, turn-entry, and socket payload types.
- `validators/play-area.ts` — Added initiative start, advance, end, and reorder payload schemas with strict empty/duplicate token-list validation.
- `validators/play-area.test.ts` — Added initiative payload schema coverage.

**Server (`server/src/features/play-area/`)**

- `initiative.service.ts` — New server-owned initiative state service with d20 initiative rolls, Dexterity modifier integration from player-owned campaign characters, sorted order, turn advancement, reorder, and end-combat reset.
- `initiative.service.test.ts` — New tests for sort logic, turn advancement, duplicate reorder rejection, and end-combat reset.
- `play-area.socket.ts` — Added DM-only initiative start, advance, end, and reorder handlers; broadcasts current initiative state to the campaign room and syncs active initiative to late joiners.
- `play-area.socket.test.ts` — Added socket coverage for DM start/advance/end behavior, non-DM rejection, and inactive initiative sync for clients that join after combat ends.

**Client (`client/src/features/play-area/`)**

- `hooks/usePlayAreaSocket.ts` — Added initiative update listener and emitters for start, advance, end, and reorder.
- `hooks/usePlayAreaSocket.test.ts` — Added initiative callback and emitter coverage.
- `components/TurnTracker.tsx` — New right-rail turn tracker with sorted combatants, active turn display, DM start/advance/end/reorder controls, and selected-token initiative start.
- `components/TurnTracker.module.css` — New tracker styling with capped height so chat remains visible below initiative.
- `components/TurnTracker.test.tsx` — New tests for DM start, turn advancement, and end-combat control.
- `canvas/TokenSprite.ts` — Added active-turn ring rendering.
- `canvas/TokenSprite.test.ts` — Added active-turn ring test coverage.
- `canvas/PlaygroundLayer.ts` — Added active token id state and sprite highlight sync.
- `canvas/CanvasManager.ts` — Exposed `setActiveTokenId()` for PlayArea initiative updates.
- `PlayArea.tsx` — Wired initiative socket state, Turn Tracker, active token highlight, stale multi-select clearing, and campaign-change initiative reset.
- `PlayArea.module.css` — Added right rail layout for Initiative above Chat.

**Dev lifecycle**

- `package.json` — Made `copilot:test` Windows-compatible by removing Unix-only `/dev/null` redirection.
- `client/vite.config.ts` — Enabled `server.strictPort` so Vite fails fast instead of silently moving off canonical port `5173`.

## Test Results

```bash
npm run test -- run shared/src/validators/play-area.test.ts
Test Files  1 passed (1)
Tests       16 passed (16)
```

```bash
npm run test -w server -- src/features/play-area/initiative.service.test.ts src/features/play-area/play-area.socket.test.ts
Test Files  2 passed (2)
Tests       36 passed (36)
```

```bash
npm run test -w client -- src/features/play-area/hooks/usePlayAreaSocket.test.ts src/features/play-area/components/TurnTracker.test.tsx
Test Files  2 passed (2)
Tests       20 passed (20)
```

```bash
npm run test -w client -- src/features/play-area/components/TurnTracker.test.tsx
Test Files  1 passed (1)
Tests       2 passed (2)
```

```bash
npm run copilot:lint -w server && npm run copilot:lint -w client
server: tsc --noEmit --pretty false passed
client: tsc --noEmit --pretty false passed
```

```bash
npm run test -w client
Test Files  31 passed (31)
Tests       378 passed (378)
```

```bash
npm run test -- run shared/src/constants/characters.test.ts shared/src/validators/play-area.test.ts
Test Files  2 passed (2)
Tests       28 passed (28)
```

```bash
npm run phase:verify -- --target full --compact
Suites: 220 passed, 0 failed (220 total)
Tests:  649 passed, 0 failed, 0 skipped (649 total)
All tests passed.
```

Manual dev lifecycle checks:

```bash
node -e "fetch('http://localhost:5173/').then((res)=>{console.log('CLIENT', res.status); if(res.ok === false) process.exit(1);}).catch((err)=>{console.error(err.message); process.exit(1);})"
CLIENT 200
```

```bash
npm run health:backend
HEALTHY 3001
```

```bash
npm run ports:check:full
FREE 5173
FREE 3001
```

Known validation caveat: later package-wide/root Vitest runs intermittently failed with `ERR_IPC_CHANNEL_CLOSED` before assertion output. Touched 4H server/client/shared tests passed directly, and the full compact phase gate passed once before the runner IPC issue recurred.

## Decisions & Insights

- Initiative state is server-owned and broadcast to the campaign room, but stored in process memory for this MVP phase because 4H did not include database persistence.
- Token records currently do not include a direct `characterId`, so initiative modifiers derive from the first campaign character owned by the player-token owner. Unlinked tokens, monsters, NPCs, and misc tokens use modifier `0`.
- DM controls are enforced server-side for start, advance, end, and reorder. The UI also hides those controls from non-DM users.
- Room join emits any existing initiative state, including inactive ended-combat state, so reconnecting clients can clear stale local initiative UI.
- Explicit initiative token lists are strict: empty, duplicate, stale, or non-active-scene token ids are rejected so combat does not start with a partial unexpected list.
- The Turn Tracker and Chat share the right rail. Initiative has an internal scroll area and capped height so Chat remains visible.
- Vite now uses `strictPort: true` to enforce the project's canonical client port policy during dev lifecycle checks.

## Dependencies Unlocked

- Phase 4I (Token Auras & Status Visualization) remains the next play-area phase.
- Post-MVP advanced combat work can build on the initiative state/event pattern established here.
