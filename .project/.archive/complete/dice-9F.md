# Feature: Dice — Phase 9F: Dice Extraction

**Completed:** October 1, 2026
**Feature:** `dice`

## Deliverables

### Root / tooling (completed earlier in the phase)
- Root `dice/` workspace removed (`dice/package.json`, `dice/src/index.ts`, `dice/tsconfig.json`, `dice/vitest.config.ts`) — DELETED
- `package.json`, `vitest.workspace.ts`, `scripts/run-compact-tests.mjs` — dropped the `dice` workspace (MODIFIED)
- `client/package.json` — `three`, `cannon-es`, `@types/three` moved in; `@vtt/dice` dep removed (MODIFIED)

### client
- `src/features/dice/engine/` (`dice.ts`, `dice.test.ts`) — MOVED from root `dice/src/engine/`
- `src/features/dice/renderer/` (`geometry.ts`, `physics.ts`, `scene.ts` + tests) — MOVED from root `dice/src/renderer/`
- `src/features/dice/dice3d/` (`animator.ts`, `three-dice-animator.ts`, `roll-mapping.ts` + tests) — MOVED from `play-area/dice3d/`, `@vtt/dice` imports swapped for relative imports
- `src/features/dice/components/DiceOverlay.tsx` (+ `.test.tsx`, `.module.css`) — MOVED from `play-area/components/`
- `src/features/dice/components/DiceRollerButton.tsx` (+ `.module.css`) — MOVED from `play-area/components/`
- `src/features/dice/hooks/useDiceSettings.ts` — MOVED from `play-area/hooks/`
- `src/features/dice/hooks/use3dDiceReveal.ts` (+ `.test.ts`) — MOVED from `play-area/hooks/`
- `src/features/play-area/PlayArea.tsx` — imports dice components/hooks from `../dice/` (MODIFIED)

### server
- `src/features/dice/dice.service.ts` (+ `dice.service.test.ts`) — MOVED from `play-area/`
- `src/features/dice/dice.socket.ts` — `registerDiceHandlers`; roll handler extracted unchanged from `play-area.socket.ts`, bound to `dice:roll` and legacy `play-area:dice:roll` (NEW)
- `src/features/dice/dice.socket.test.ts` — new event, legacy alias, observer reject, invalid formula, cooldown (NEW)
- `src/features/play-area/play-area.socket.ts` — roll handler and dice imports removed (MODIFIED)
- `src/shared/socket/index.ts` — registers `registerDiceHandlers` after `registerPlayAreaHandlers` (MODIFIED)

### shared
- `src/constants/dice.ts` — `DICE_FORMULA_MAX_LENGTH`, `DICE_MAX_COUNT`, `DICE_MAX_SIDES`, `DICE_ROLL_COOLDOWN_MS`, `DICE_EVENTS` (`DICE_ROLL: 'dice:roll'`, `DICE_ROLL_LEGACY: 'play-area:dice:roll'`), `DICE_3D_*` (MODIFIED)
- `src/types/dice.ts` — `DiceFormula`, `RollResult`, `DiceRollPayload`, `DiceAnimationMode` (MODIFIED)
- `src/validators/dice.ts` — `diceRollPayloadSchema`, `DiceRollInput` (MODIFIED)
- `src/{constants,types,validators}/play-area.ts` — dice sections removed (MODIFIED)

### docs
- `.github/instructions/feature-dice.instructions.md` — Code Ownership table, `applyTo`, event notes (MODIFIED)
- `.github/instructions/feature-play-area.instructions.md` — Dice Roller section points at `features/dice/` (MODIFIED)
- `.github/agents/architect.agent.md` — roll event name (MODIFIED)
- `.project/project-tree.md`, `.project/features/dice.md`, `.project/roadmap.md` (MODIFIED)

## Test Results

Slug-scoped run (`npm run phase:verify -- --slug dice --compact`):
```
RUN 1/9 client/src/features/dice/components/DiceOverlay.test.tsx
RUN 2/9 client/src/features/dice/dice3d/constants.test.ts
RUN 3/9 client/src/features/dice/dice3d/roll-mapping.test.ts
RUN 4/9 client/src/features/dice/engine/dice.test.ts
RUN 5/9 client/src/features/dice/hooks/use3dDiceReveal.test.ts
RUN 6/9 client/src/features/dice/renderer/geometry.test.ts
RUN 7/9 client/src/features/dice/renderer/scene.test.ts
RUN 8/9 server/src/features/dice/dice.service.test.ts
RUN 9/9 server/src/features/dice/dice.socket.test.ts
Suites: 31 passed, 0 failed (31 total)
Tests:  99 passed, 0 failed, 0 skipped (99 total)
All tests passed.
```

Full workspace (`npm run phase:verify -- --target full --compact`, after code-review fixes):
```
> client@0.0.1 copilot:lint
> tsc --noEmit --pretty false
> server@0.0.1 copilot:lint
> tsc --noEmit --pretty false
> vtt@0.0.1 copilot:test
RETRY server/src/features/editor/walls.routes.test.ts — transient socket error (ECONNRESET-class flake)
Suites: 389 passed, 0 failed (389 total)
Tests:  1228 passed, 0 failed, 0 skipped (1228 total)
All tests passed.
```

ESLint on all touched dice/shared/socket files: no findings.

Dev startup (`npm run dev` + `npm run dev:lifecycle:verify`): `HEALTHY 5173`, `HEALTHY 3001`; Vite served `PlayArea.tsx`, `dice/components/DiceOverlay.tsx`, `dice/components/DiceRollerButton.tsx`, `dice/hooks/use3dDiceReveal.ts` with HTTP 200.

Grep check: no `@vtt/dice` imports remain in code.

## Decisions & Insights

- The legacy alias is its own constant (`DICE_EVENTS.DICE_ROLL_LEGACY`) bound to the same handler, so removing it later is a one-line delete.
- Roll errors still go out on `play-area:error` to keep client toast handling unchanged. Switching to `dice:error` belongs with 9A's structured parse errors.
- `registerDiceHandlers` relies on the play-area room join for `socket.data.campaignId` and `campaignRole`, so it is registered alongside `registerPlayAreaHandlers` in the socket setup.
- Socket tests should await the joining socket's `play-area:user:joined` instead of a fixed delay. The room join is async and sets `socket.data` before that broadcast.
- Gotcha: an earlier scaffold had left an empty `server/src/features/dice/dice.service.ts` stub, which blocked `git mv`. It needed `git mv -f`. The phase scaffold also emitted a route test and a fetch hook that don't fit a pure-move phase, so both were deleted.
- `feature-dice.instructions.md` `applyTo` no longer matches `play-area/dice.service*.ts`, because that path no longer exists.

## Dependencies Unlocked

- None blocking. 9F had no dependents in the graph. Phases 9A–9E can now build directly on `features/dice/` with no remaining play-area dice code to route around.
- Follow-up: remove `DICE_EVENTS.DICE_ROLL_LEGACY` after one release.
