# Feature: play-area — Phase 4F.2: NPC Token Subtypes (Ally & Enemy)

**Completed:** June 7, 2026
**Feature:** `play-area`

## Deliverables

**shared/**

- `shared/src/types/play-area.ts` — Added `NpcSubtype = 'ally' | 'enemy'`; added `npcSubtype?: NpcSubtype` to `Token`, `TokenCreatePayload`, `TokenUpdatePayload`
- `shared/src/validators/play-area.ts` — Added optional `npcSubtype` enum field to `tokenCreatePayloadSchema` and `tokenUpdatePayloadSchema`
- `shared/src/validators/play-area.test.ts` — Validator tests for `npcSubtype`

**server/**

- `server/prisma/schema.prisma` — Added `NpcSubtype` enum and optional `npcSubtype NpcSubtype?` column on `Token`
- `server/prisma/migrations/20260607234211_add_npc_subtype_to_token/migration.sql` — Migration for `npcSubtype`
- `server/prisma/seed.ts` — Added one ally NPC token ("Town Guard") and one enemy NPC token ("Goblin") to the seeded scene
- `server/src/features/play-area/tokens.service.ts` — `npcSubtype` included in `toToken` mapper, `createToken`, `updateToken`
- `server/src/features/play-area/vision.service.ts` — Ally NPC tokens included in player-facing vision reveal set; enemy NPC tokens DM-only
- `server/src/features/play-area/tokens.routes.test.ts` — Route tests for NPC subtype CRUD
- `server/src/features/play-area/vision.service.test.ts` — Vision gating tests for ally/enemy subtypes

**client/**

- `client/src/features/play-area/canvas/TokenSprite.ts` — Ally tokens render with green tint + "A" label; enemy tokens render with red tint + "E" label
- `client/src/features/play-area/canvas/TokenSprite.test.ts` — Canvas rendering tests for subtype styles
- `client/src/features/play-area/components/TokenHoverCard.tsx` — Displays `npcSubtype` in hover card
- `client/src/features/play-area/components/TokenHoverCard.test.tsx` — Hover card tests for subtype display

## Test Results

Command: `npx vitest run`
Result: **344 passed, 0 failed** (27 test files)

Key Phase 4F.2 tests:

```
✓ emitVisionSync — NPC subtype vision gating (Phase 4F.2) > includes ally NPC token reveals in player vision sync
✓ emitVisionSync — NPC subtype vision gating (Phase 4F.2) > excludes enemy NPC token reveals from player vision sync
✓ emitVisionSync — NPC subtype vision gating (Phase 4F.2) > includes both ally and enemy NPC token reveals in DM vision sync
✓ emitVisionSync — NPC subtype vision gating (Phase 4F.2) > excludes null-subtype NPC tokens (enemy fallback) from player vision sync
✓ Play Area Token Routes > NPC subtype (Phase 4F.2) > DM can create an ally NPC token
✓ Play Area Token Routes > NPC subtype (Phase 4F.2) > DM can create an enemy NPC token
✓ Play Area Token Routes > NPC subtype (Phase 4F.2) > NPC token without subtype has null npcSubtype in response
✓ Play Area Token Routes > NPC subtype (Phase 4F.2) > non-NPC token has null npcSubtype in response
✓ Play Area Token Routes > NPC subtype (Phase 4F.2) > returns 400 for invalid npcSubtype value
✓ Play Area Token Routes > NPC subtype (Phase 4F.2) > DM can update npcSubtype on an NPC token
✓ Play Area Token Routes > NPC subtype (Phase 4F.2) > DM can clear npcSubtype on an NPC token (set to null)
✓ Play Area Token Routes > NPC subtype (Phase 4F.2) > player cannot set npcSubtype on their own token
✓ Play Area Token Routes > NPC subtype (Phase 4F.2) > returns 400 when npcSubtype is set on a non-NPC token type on create
```

## Decisions & Insights

- `npcSubtype` is nullable; tokens with `type !== 'npc'` always have `null` — enforced in both validator and service layer
- Tokens with `type === 'npc'` and `npcSubtype === null` default to enemy behaviour (no vision sharing) — backward-compatible fallback
- Ally NPC tokens are included in the player-facing `TOKEN_VISION_SYNC` payload alongside player tokens; no new socket event was needed
- All NPC tokens remain DM-controlled regardless of subtype (`ownerId` stays null)

## Dependencies Unlocked

- **Phase 4F.3: DM Toolbar** — now unblocked (depends on 4F.2)
