# Archived Phase 4F.2: NPC Token Subtypes (Ally & Enemy)

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-06-08

---

## Phase 4F.2: NPC Token Subtypes (Ally & Enemy)

**Dependencies:** Phase 4F.1

### Tasks
- [x] Add `NpcSubtype` enum (`ally`, `enemy`) to Prisma schema; add optional `npcSubtype NpcSubtype?` column on `Token`
- [x] Generate and apply migration: `add_npc_subtype_to_token`
- [x] Update `seed.ts`: add one ally and one enemy NPC token to the seeded scene
- [x] Shared types: add `NpcSubtype = 'ally' | 'enemy'`; add `npcSubtype?: NpcSubtype` to `Token`, `TokenCreatePayload`, `TokenUpdatePayload`
- [x] Shared validators: add optional `npcSubtype` enum field to `tokenCreatePayloadSchema` and `tokenUpdatePayloadSchema`
- [x] Server `tokens.service.ts`: include `npcSubtype` in the `toToken` mapper, `createToken`, `updateToken`
- [x] Server `vision.service.ts`: include ally NPC tokens (`type === 'npc' && npcSubtype === 'ally'`) in the player-facing vision reveal set; enemy NPC vision remains DM-only
- [x] Client canvas: render ally NPC tokens with a distinct placeholder style (green tint + "A" label); enemy NPC tokens with a distinct style (red tint + "E" label)
- [x] Write tests: ally vision included in player sync, enemy vision excluded, `toToken` mapper, validators

### Decisions
- `npcSubtype` is nullable; tokens with `type !== 'npc'` always have `null`
- Tokens with `type === 'npc'` and `npcSubtype === null` default to enemy behaviour (no vision sharing) — safe backward-compatible fallback
- `ally` NPC tokens are included in the player-facing `TOKEN_VISION_SYNC` payload alongside player tokens; no new socket event needed
- All NPC tokens remain DM-controlled regardless of subtype (`ownerId` stays null)

---


