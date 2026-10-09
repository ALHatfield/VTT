# Feature: characters — Phase 6C: Interactive Rolling

**Completed:** October 7, 2026
**Feature:** `characters`

## Deliverables

**Shared (`shared/src/`)**
- `types/characters.ts` — `SkillName`, `AbilityName`, `RollAdvantageMode`, `CharacterAttack`; `Character`/create/update payloads extended with `skillProficiencies` + `attacks`
- `types/dice.ts` — optional `label` on `DiceRollPayload` and `RollResult`
- `constants/characters.ts` — `SKILL_NAMES`, `SKILL_DEFINITIONS` (18 5e skills with governing abilities), `ROLL_ADVANTAGE_MODES`, `CHARACTER_MAX_ATTACKS`, `ATTACK_NAME_MAX_LENGTH`, `DAMAGE_DICE_PATTERN`, `buildD20RollFormula()`, `buildDamageRollFormula()`
- `constants/dice.ts` — `ROLL_LABEL_MAX_LENGTH`
- `validators/characters.ts` — `skillProficienciesSchema` (enum, unique), `characterAttackSchema` + `attacksSchema` (unique ids, strict damage-dice regex), wired into create/update schemas
- `validators/dice.ts` — optional trimmed/length-capped `label` on `diceRollPayloadSchema`
- `constants/characters.test.ts` — formula builders, skill definitions, damage-dice pattern, label-length coupling guard

**Server (`server/`)**
- `prisma/schema.prisma` + migration `20261007191112_add_character_skills_and_attacks` — `Character.skillProficiencies Json @default("[]")`, `Character.attacks Json @default("[]")`
- `src/features/characters/characters.service.ts` — maps and persists the new fields
- `src/features/dice/dice.socket.ts` — passes the optional roll label through to the persisted `rollData` and broadcast
- `src/features/characters/characters.routes.test.ts` — create/update with skills + attacks, defaults, invalid skill, invalid dice, duplicate skills
- `src/features/dice/dice.socket.test.ts` — label persistence/broadcast, oversized label rejection

**Client (`client/src/features/`)**
- `characters/components/StatsTab.tsx` + `StatsTab.module.css` (new) — clickable ability cards, 18 rollable skills with proficiency edit mode, attack rows with Attack/Damage rolls and add/remove form, advantage/disadvantage toggle, clickable Initiative; edit controls gated by `canEdit`
- `characters/components/StatsTab.test.tsx` (new) — 15 component tests
- `characters/CharacterSheet.tsx` — wires StatsTab; owner/DM + observer role gating via `useAuth` + `useCampaign`; optimistic skill/attack updates; roll error alert; rolls use stored `proficiencyBonus`
- `characters/CharacterSheet.module.css` — extracted stats styles removed
- `characters/hooks/useCharacterSocket.ts` — now returns `emitDiceRoll(formula, label?)`, `isConnected` (confirmed after room join), `lastError` (server rejections)
- `characters/utils.ts` — shared `formatModifier()`
- `characters/components/MemberLinkControls.test.tsx` — fixture updated for new required fields
- `play-area/components/ChatPanel.tsx` (+ test) — renders roll label: `rolled d20+5 (DEX)`

## Test Results

```
npm run phase:verify -- --target full --compact
Suites: 417 passed, 0 failed (417 total)
Tests:  1345 passed, 0 failed, 0 skipped (1345 total)
All tests passed.
```

Dev servers verified healthy (`npm run dev:lifecycle:verify` → HEALTHY 5173 / HEALTHY 3001); ports confirmed free after cleanup.

## Decisions & Insights

- **Skill/attack data model**: skills are a fixed shared list (`SKILL_DEFINITIONS`) with only proficiency names stored per character; attacks are client-id'd JSON entries (`id`, `name`, `ability`, `proficient`, `damageDice`). Attack roll = d20 + ability mod + proficiency (when proficient); damage = damageDice + ability mod.
- **Roll labels**: rather than new events, an optional `label` field rides the existing `dice:roll` payload and `RollResult`. The dice socket is a pure pass-through; ChatPanel renders it. Attack-name max length + `" attack"` suffix is guarded by a shared test against `ROLL_LABEL_MAX_LENGTH`.
- **Socket wiring**: dice handlers register on every connection, so the sheet's existing `useCharacterSocket` connection can roll directly — no play-area hook dependency. `isConnected` flips only after the server's user-joined broadcast confirms the room join (rolls before that would be rejected FORBIDDEN).
- **Error surfacing**: the server's 1s roll cooldown and observer/forbidden rejections now surface via `lastError` → `role="alert"` on the sheet (previously silent).
- **Stale-state guard**: skill/attack edits use optimistic local state shadowing the server copy, so rapid toggles never compute from a stale render closure (per the project's documented hook pitfall).
- **Proficiency source of truth**: rolls and display use the stored editable `Character.proficiencyBonus`, not the level-derived value.
- **Gotcha**: adding required fields to the shared `Character` type broke an existing test fixture (`MemberLinkControls.test.tsx`) — grep for fixtures when widening shared types.

## Dependencies Unlocked

- `characters` 6D (Spells & Slots) and 6E (Export & History) — depend on 6A, now next in track order
- play-area 4G initiative tracker can consume character initiative modifiers (Initiative roll integration shipped)
