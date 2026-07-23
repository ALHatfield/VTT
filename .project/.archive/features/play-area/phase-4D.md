# Archived Phase 4D: Chat System

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-06-01

---

Original phase section was already archived in the feature roadmap at archive time.

## Completion Record Snapshot

# Play Area — Phase 4D: Chat System

**Completed:** 2026-05-31
**Feature:** `play-area`

## Deliverables

### shared/
- `src/types/play-area.ts` — Added `MessageType`, `ChatMessage`, `ChatSendPayload`, `ChatReceivedPayload` (MODIFIED)
- `src/constants/play-area.ts` — Added `CHAT_EVENTS`, `CHAT_MESSAGE_MAX_LENGTH`, `CHAT_HISTORY_LIMIT`, `CHAT_HISTORY_MAX_LIMIT` (MODIFIED)
- `src/validators/play-area.ts` — Added `chatSendPayloadSchema`, `ChatSendInput` (MODIFIED)

### server/
- `prisma/schema.prisma` — Added `MessageType` enum and `CampaignMessage` model (MODIFIED)
- `prisma/migrations/20260531233253_add_campaign_message_model/migration.sql` — Migration file (NEW)
- `src/features/play-area/messages.routes.ts` — `GET /api/campaigns/:id/messages` REST endpoint (NEW)
- `src/features/play-area/play-area.socket.ts` — Added `play-area:chat:send` handler (MODIFIED)
- `src/app.ts` — Registered `messagesRouter` (MODIFIED)
- `src/features/play-area/messages.routes.test.ts` — 8 tests for REST endpoint (NEW)
- `src/features/play-area/play-area.socket.test.ts` — Added 5 chat tests; 14 socket tests total (MODIFIED)

### client/
- `src/features/play-area/hooks/useChatMessages.ts` — Fetches history on mount, exposes `addMessage` (NEW)
- `src/features/play-area/hooks/usePlayAreaSocket.ts` — Added `emitChatSend`, `onChatReceived`, `isConnected` (MODIFIED)
- `src/features/play-area/components/ChatPanel.tsx` — Full chat UI component (MODIFIED — previously placeholder)
- `src/features/play-area/components/ChatPanel.module.css` — Complete styles with connection status pulse animation (MODIFIED)
- `src/features/play-area/components/ChatPanel.test.tsx` — 14 tests for ChatPanel (NEW)
- `src/features/play-area/PlayArea.tsx` — Wired up `useChatMessages`, `emitChatSend`, `isConnected`, `<ChatPanel>` (MODIFIED)
- `src/test-setup.ts` — Added `scrollIntoView` no-op stub for jsdom (MODIFIED)

## Test Results

```
npx vitest run

 Test Files  18 passed (18)
      Tests  212 passed (212)
```

All 212 tests pass across all packages. Key new test coverage:
- `messages.routes.test.ts` (8 tests): empty array, ascending order, limit param, limit cap at 100, member read access, 401 unauthenticated, 403 non-member, expected fields
- `play-area.socket.test.ts` (5 new, 14 total): message echoed to sender, broadcast to all members, rejected mismatched campaignId, rejected >2000 chars, rejected empty messages
- `ChatPanel.test.tsx` (14 tests): empty state, loading, message rendering, system messages, connection status, send on Enter, clear after send, Shift+Enter doesn't send, whitespace not sent, disabled when disconnected, error banner with dismiss

## Decisions & Insights

- **Route param**: Messages route uses `/:id/messages` (`:id` param) not `/:campaignId/messages` because `campaigns.middleware.ts` reads `req.params.id`. Using the wrong param caused silent authentication bypass in early implementation.
- **Socket.IO v4 reconnect**: `reconnect` fires on the Manager (`socket.io.on('reconnect', ...)`), not the socket. The test mock must include a `.io` object with `on`/`off` methods — plain `{ on, off, emit, disconnect }` doesn't work.
- **scrollIntoView in jsdom**: jsdom doesn't implement `scrollIntoView`, causing test failures. Fixed with a no-op stub in `client/src/test-setup.ts`.
- **Error banner test**: HTML `maxLength` attribute blocks inputs longer than the limit. Testing the JS validation path requires `fireEvent.change()` to bypass it, then wrapping in `act()` for the state update.
- **Optimistic send via echo**: Server broadcasts to all room members including sender (`io.to(room).emit`) — single code path, no client-side deduplication needed.

## Dependencies Unlocked

Per the dependency graph in `roadmap.md`:
- **play-area 4E** (Dice Roller) — now unblocked (depended on 4D)
- **play-area 4G** (Initiative & Turn Tracker) remains blocked on 4E + characters 6A
