# Feature: play-area — Phase 4J: Measure Tool & Player Color

**Completed:** August 31, 2026
**Feature:** `play-area`

## Deliverables

**Shared (`shared/src/`)**

- `constants/campaigns.ts` — Added `PLAYER_COLOR_PALETTE` (8-color preset)
- `types/campaigns.ts` — Added `color: string | null` to `CampaignPlayer`
- `types/play-area.ts` — Added `MeasureBroadcastPayload`, `MeasureClearPayload`, `MeasureRelayedPayload`, `MeasureClearedPayload`
- `constants/play-area.ts` — Added `MEASURE_EVENTS`, `MEASURE_LINE_WIDTH`, `MEASURE_LINE_ALPHA`
- `validators/play-area.ts` — Added `measureBroadcastPayloadSchema`, `measureClearPayloadSchema`

**Server (`server/`)**

- `prisma/schema.prisma` — Added `color String?` to `CampaignPlayer`
- `prisma/migrations/20260831213724_add_player_color/` — Migration adding color column
- `prisma/seed.ts` — Assign palette colors to seed campaign members
- `src/features/campaigns/campaigns.service.ts` — `toCampaignPlayer` now includes color; `createCampaign` assigns first palette color to DM; `inviteMember` calls `nextPaletteColor` to cycle the palette
- `src/features/play-area/play-area.socket.ts` — Added `MEASURE_BROADCAST` and `MEASURE_CLEAR` handlers; stores authoritative `playerColor` at room-join; private broadcast routes only to DM sockets

**Client (`client/src/features/play-area/`)**

- `canvas/CanvasManager.ts` — Added `'measure'` to `ToolMode`
- `canvas/PlaygroundLayer.ts` — Added `drawLocalMeasureLine`, `drawRemoteMeasureLine`, `clearLocalMeasureLine`, `clearRemoteMeasureLine`, `clearAllRemoteMeasureLines` with proper Graphics destroy on clear
- `canvas/grid-utils.ts` — Added `snapToGridCenter`
- `components/CanvasToolbar.tsx` — Added Measure tool (DM + Player); Private broadcast checkbox panel
- `components/CanvasToolbar.module.css` — Added `.measurePanel`, `.measureToggle`
- `hooks/useMeasureTool.ts` — New hook: snap-to-center, distance calc, PixiJS render, socket broadcast via callbacks
- `hooks/useCampaignRole.ts` — Extended to return `playerColor` by reading member list from campaign detail
- `hooks/usePlayAreaSocket.ts` — Added `onMeasureRelayed`/`onMeasureCleared` callbacks; added `emitMeasureBroadcast`/`emitMeasureClear` emit functions; removed raw `socketRef` from public API
- `PlayArea.tsx` — Wired measure tool, overlay div, socket callbacks; uses `calcMeasureDistance`/`formatMeasureLabel` for remote relay labels
- `PlayArea.module.css` — Added `.measureOverlay`

**Tests**

- `canvas/grid-utils.test.ts` — 3 new `snapToGridCenter` tests
- `hooks/useMeasureTool.test.ts` — 7 tests: horizontal/vertical/diagonal distance, zero distance, label formatting
- `components/CanvasToolbar.test.tsx` — Updated for Measure tool; 3 new tests for Private toggle
- `server/features/campaigns/campaigns.routes.test.ts` — 2 new tests: color on campaign detail, color on invite
- `server/features/play-area/play-area.socket.test.ts` — 5 new measure handler tests: public relay, no echo, private-to-DM-only, clear relay, invalid payload

## Test Results

```
npx vitest run --reporter=verbose
Test Files  41 passed (41)
Tests       567 passed (567)
```

Key measure socket tests:

- ✓ relays public measurement broadcast to other room members
- ✓ does not echo public broadcast back to sender
- ✓ relays private measurement only to DM
- ✓ relays measure clear to other room members
- ✓ emits INVALID_PAYLOAD for malformed measure broadcast

## Decisions & Insights

- **Color impersonation prevention**: Server injects `socket.data.playerColor` (stored at room-join from DB) into relayed payloads. Client-supplied `color` is ignored server-side. This pattern should be applied to any future tool that broadcasts color-keyed data.
- **Private broadcast routing**: `MeasureClearPayload` carries `isPrivate` so the server can route the clear to the same audience as the original broadcast. Without this, a private measurement clear would leak presence info to the whole room.
- **Graphics lifecycle**: Remote measure `Graphics` instances are destroyed (`g.destroy()` + `removeChild`) when cleared, not just cleared. A `drawRemoteMeasureLine` call re-creates the Graphics if needed. This prevents memory leaks when players repeatedly measure.
- **Socket emit encapsulation**: `emitMeasureBroadcast` / `emitMeasureClear` follow the `emitTokenMove` / `emitChatSend` pattern — no raw `socketRef` in the public API.
- **UUID validation**: Measure payload validators use `z.string().uuid()` for `campaignId` (consistent with other socket validators).
- **`phase:verify --slug play-area` returns 0 tests** due to a workspace-level glob issue — run with `npx vitest run --project client "play-area"` or `npx vitest run --reporter=verbose` for the full suite.

## Dependencies Unlocked

- Phase 4K (Drawing Tools) — depends on 4F.3 and now can leverage player color infrastructure from 4J
- Phase 4F.4 (Fog of War Toolbar Integration) — depends on 4F.3 (already met)
- Phase 4F.5 (NPC Token Placement Tool) — depends on 4F.3 (already met)
