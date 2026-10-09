---
description: "Dice feature — advanced roll expressions, roll visibility, macros, roll history, and dice skins building on the play-area roller and the Three.js dice renderer."
applyTo: "**/features/dice/**"
---
# Feature: dice

> For current phase status and tasks, see `.project/features/dice.md`

## Overview
Dice owns everything about rolling: parsing roll expressions, generating results server-side, deciding who can see a roll, saved roll macros, roll history, and how dice look in 3D. The base roller (play-area 4E) and 3D renderer (play-area PM1) originally shipped under play-area and the former root `@vtt/dice` package; Phase 9F moved all of it into `features/dice/`. All dice work goes in `features/dice/`.

## Code Ownership
| Concern | Location |
|---------|----------|
| Formula parsing + RNG | `server/src/features/dice/dice.service.ts` |
| Roll socket handler | `server/src/features/dice/dice.socket.ts` (`registerDiceHandlers`, registered in `server/src/shared/socket/index.ts`) |
| Dice types / constants / validators | `shared/src/{types,constants,validators}/dice.ts` |
| 3D engine + renderer | `client/src/features/dice/engine/`, `client/src/features/dice/renderer/` |
| 3D animator seam | `client/src/features/dice/dice3d/` |
| Overlay, roller button, settings, reveal | `client/src/features/dice/{components,hooks}/` (`DiceOverlay`, `DiceRollerButton`, `useDiceSettings`, `use3dDiceReveal`) |

- `PlayArea.tsx` composes dice components (same pattern as editor components) — dice never imports play-area canvas internals
- Roll results are still posted as `roll` chat messages; chat persistence stays in play-area

## Roll Rules
- Server is the only source of randomness (`node:crypto` `randomInt`) — clients never generate results; the 3D renderer only plays back a server value
- Every expression is bounded before rolling: formula length, total dice across all terms, sides per die, explode/reroll iterations, and modifier size — reject, never truncate
- Parser is a pure function returning `null` (or a structured error) for invalid input — no `eval`, no regex-only parsing of nested math
- `RollResult` stays backward compatible: legacy fields (`count`, `sides`, `rolls`, `keptRolls`, `total`) remain populated so persisted `rollData` and `mapRollToDice` keep working
- Per-user roll cooldown (`DICE_ROLL_COOLDOWN_MS`) applies to every roll entry point — chat, quick-pick, token, macro, sheet

## Roll Visibility
- Modes: `public` (everyone), `gm` (roller + DMs), `blind` (DMs only — roller sees a hidden placeholder), `self` (roller only)
- Filtering happens server-side per socket and in the message history REST endpoint — hidden results must never reach an unauthorized socket, not even in `rollData`
- Observers can't roll; they see only `public` rolls
- Non-recipients get neither a result nor a 3D animation for hidden rolls

## Data Model
- **CampaignMessage** (play-area model): gains a `visibility` column for roll messages (9B); dice owns the column's semantics
- **DiceMacro**: user-owned saved roll (`name`, `formula`, `visibility`, `sortOrder`), optionally scoped to a campaign and/or character
- **DiceSkin**: one row per user — body color, label color, material — applied to that user's 3D dice for everyone
- Roll history/stats read existing `roll` messages — no separate roll log table

## Role-Based Access
- **DM**: Rolls with any visibility; sees `gm` and `blind` rolls from everyone; can view all players' roll stats
- **Player**: Rolls with any visibility; sees `public` rolls plus their own `gm`/`self` rolls; manages only their own macros and skin
- **Observer**: Read-only — no rolling, no macros; sees `public` rolls only
- Return `404` for macros owned by another user

## API Endpoints
Mounted per resource; all use `requireAuth`. Campaign-scoped routes also use `requireCampaignRole`.

- `GET|POST /api/dice/macros`, `PUT|DELETE /api/dice/macros/:macroId` — own macros (`?campaignId=&characterId=` filters)
- `GET|PUT /api/dice/skin` — own dice skin
- `GET /api/campaigns/:id/rolls` — visibility-filtered, cursor-paginated roll history (`?userId=&q=`)
- `GET /api/campaigns/:id/rolls/stats` — per-player aggregates computed from visible rolls

## Real-time Events
- Roll intent: `DICE_EVENTS.DICE_ROLL` (`dice:roll`). `DICE_EVENTS.DICE_ROLL_LEGACY` (`play-area:dice:roll`) is still accepted for one release — remove it once no client emits it. Roll errors still go out on `play-area:error`
- New event names live in `DICE_FEATURE_EVENTS` (`shared/src/constants/dice.ts`), prefixed `dice:`
- Macro and skin mutations go through REST; the server emits `dice:macro:*` to the owner's sockets only and `dice:skin:updated` to the owner's campaign rooms
- Roll broadcasts are per-socket (not a single room emit) whenever visibility isn't `public`

## 3D Rendering
- Renderer API surface (`DiceScene`, `createStandardDie`, `createDiceDefinition`) stays behind the `DiceAnimator` seam — UI code never imports Three.js directly
- Pre-simulate → stamp server value on the landed face → play back (PM1 design); verify presentation against the camera, not world axes
- Skins change materials only — geometry and physics stay identical so results never depend on appearance
- Respect `prefers-reduced-motion` and the WebGL probe fallback to `instant` mode

## Prior Art (Project_Pathfinder)
- Standalone `~/Desktop/dice` project (Three.js + cannon-es) — source of the `@vtt/dice` engine/renderer; its client-side RNG was deliberately not ported
- Chat `/roll` command parsing with message persistence

## Integration Points
- **Play Area**: Hosts the dice overlay and roller button; persists roll results as `roll` chat messages; chat history endpoint applies roll visibility
- **Characters**: Sheet rolls (6C) send formulas through the dice pipeline; macros can be scoped to a character
- **Bestiary**: Stat block rolls (8C) use the dice pipeline; DM hidden rolls map to `gm`/`blind` visibility
- **Campaigns**: Roll history, stats, and campaign-scoped macros are filtered by campaign membership and role
