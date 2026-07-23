# Play Area — Phase 4E: Dice Roller

**Completed:** 2026-05-31
**Feature:** `play-area`

## Deliverables

### shared/
- `src/types/play-area.ts` — Added `DiceFormula`, `RollResult`, `DiceRollPayload` interfaces (MODIFIED)
- `src/validators/play-area.ts` — Added `diceRollPayloadSchema` Zod validator (MODIFIED)
- `src/constants/play-area.ts` — Added `DICE_EVENTS`, `DICE_MAX_COUNT`, `DICE_MAX_SIDES`, `DICE_FORMULA_MAX_LENGTH` (MODIFIED)

### server/
- `src/features/play-area/dice.service.ts` — `parseDiceFormula` + `rollDiceFormula` using `crypto.randomInt` (NEW)
- `src/features/play-area/dice.service.test.ts` — 27 tests covering parsing, RNG, advantage/disadvantage (NEW)
- `src/features/play-area/play-area.socket.ts` — `DICE_ROLL` socket event handler with observer guard (MODIFIED)

### client/
- `src/features/play-area/hooks/usePlayAreaSocket.ts` — Added `emitDiceRoll` callback (MODIFIED)
- `src/features/play-area/components/ChatPanel.tsx` — `/roll` command detection, `RollBreakdown` component (MODIFIED)
- `src/features/play-area/components/ChatPanel.module.css` — Roll breakdown styles (MODIFIED)
- `src/features/play-area/components/ChatPanel.test.tsx` — 5 dice roll tests added (MODIFIED)
- `src/features/play-area/components/DiceRollerButton.tsx` — Replaced disabled stub with working quick-pick menu (MODIFIED)
- `src/features/play-area/components/DiceRollerButton.module.css` — Menu/grid/input styles (MODIFIED)
- `src/features/play-area/components/TokenHoverCard.tsx` — Attack/Damage quick-roll wired to `onQuickRoll` prop (MODIFIED)
- `src/features/play-area/components/TokenHoverCard.module.css` — Fixed hardcoded disabled stub styles on `.rollButton` (MODIFIED)
- `src/features/play-area/PlayArea.tsx` — `emitDiceRoll` wired to ChatPanel, DiceRollerButton, and TokenHoverCard (MODIFIED)

## Test Results

```
# Server — dice service
npx vitest run src/features/play-area/dice.service.test.ts
✓ parseDiceFormula (19 tests)
✓ rollDiceFormula (8 tests)
Tests: 27 passed

# Client — full suite
npx vitest run
Test Files: 12 passed
Tests: 129 passed
```

## Decisions & Insights

- **DiceRollerButton** was a hardcoded-disabled stub from Phase 4A layout work. Replaced with a popover menu: d4/d6/d8/d10/d12/d20/d100 quick-pick grid + custom formula input field. Menu opens above the button (absolute positioned, `bottom: calc(100% + 8px)`).
- **TokenHoverCard quick-roll** CSS had `cursor: not-allowed; opacity: 0.6` baked onto `.rollButton` from the stub phase — it was making buttons look disabled regardless of the HTML `disabled` attribute. Fixed by moving those styles to `.rollButton:disabled`.
- **Observer guard** added to socket handler — observers are read-only and cannot persist roll messages.
- **Advantage + disadvantage** mutual exclusion enforced in `parseDiceFormula` — returns `null` if both flags present.
- **Modifier bounds** clamped to ±10,000 to prevent integer overflow in display.
- **Prisma JSON** — `rollResult` must be spread (`{ ...rollResult }`) to satisfy `InputJsonValue`'s index signature requirement.
- **`/roll` command** prefix is `/roll ` (with trailing space) to avoid false-positives on messages like `/rolled`.

## Dependencies Unlocked

- Phase 4F (Fog of War) — was already unblocked by 4A; 4E has no blockers on it
- Phase 4G (Initiative & Turn Tracker) — depends on 4E per feature doc
