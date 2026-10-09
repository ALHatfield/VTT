# Archived Phase 9F: Dice Extraction

- Feature: `dice`
- Source: `.project/features/dice.md`
- Archived: 2026-10-01

---

## Phase 9F: Dice Extraction

**Dependencies:** None

### Tasks
- [x] Move `dice/src/engine/` and `dice/src/renderer/` into `client/src/features/dice/engine/` and `client/src/features/dice/renderer/` (with tests); move `three`, `cannon-es`, `@types/three` into `client/package.json`
- [x] Remove the root `dice/` workspace: root `package.json` workspaces, `clean` and `copilot:verify` scripts, `vitest.workspace.ts`, `scripts/run-compact-tests.mjs` (`TEST_ROOTS`, workspace list, `diceFiles` batch), and the `@vtt/dice` dep in `client/package.json`
- [x] Move `client/src/features/play-area/dice3d/` → `client/src/features/dice/dice3d/`; swap `@vtt/dice` imports for relative imports
- [x] Move `DiceOverlay`, `DiceRollerButton`, `useDiceSettings`, `use3dDiceReveal` (and tests/CSS) into `client/src/features/dice/`; `PlayArea.tsx` imports them from `../dice/`
- [x] Move `server/src/features/play-area/dice.service.ts` (+ test) → `server/src/features/dice/dice.service.ts`; extract the roll handler from `play-area.socket.ts` into `dice.socket.ts` and register it from the socket setup
- [x] Move dice sections (Phase 4E/PM1) of `shared/src/{types,constants,validators}/play-area.ts` into `shared/src/{types,constants,validators}/dice.ts`
- [x] Rename roll intent `play-area:dice:roll` → `dice:roll`; keep the old name as an alias for one release
- [x] Update `feature-play-area.instructions.md`, `.project/project-tree.md`, and this doc's Code Ownership table
- [x] Tests: full workspace suite green with no behavior changes; grep confirms no remaining `@vtt/dice` imports

### Decisions
- Pure move/rename — no behavior changes bundled in
- The renderer becomes client-only code; the isomorphic `DiceDefinition` goes with it since only the client uses it
- Phases 9A–9E put new code in `features/dice/` regardless of whether 9F has landed
- Legacy alias is a separate constant (`DICE_EVENTS.DICE_ROLL_LEGACY`) bound to the same handler, so removing it later is a one-line delete
- Roll errors still go out on `play-area:error` (not `dice:error`) to keep client toast handling unchanged; switching channels belongs with 9A's structured parse errors
- `registerDiceHandlers` relies on the play-area room join for `socket.data.campaignId`/`campaignRole` and is registered right after `registerPlayAreaHandlers`

---


