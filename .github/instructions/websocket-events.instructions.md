---
description: "Conventions for Socket.IO event handling, naming, and real-time communication patterns."
applyTo: "**/socket/**,**/features/play-area/**"
---
# WebSocket Conventions (Socket.IO)

## Event Naming
- Use colon-delimited namespaces: `campaign:token:move`, `campaign:dice:roll`, `campaign:chat:message`
- Client-to-server intents use present tense: `token:move`, `dice:roll`
- Server-to-client broadcasts use past tense: `token:moved`, `dice:rolled`
- Define all event names as string constants in `shared/constants/events.ts`

## Event Payloads
- Type all event payloads using interfaces from `shared/types/events.ts`
- Server validates every incoming payload before processing — never trust client data
- Include `campaignId` in payloads to scope events to the correct room

## Room Strategy
- Each campaign has a room: `campaign:{campaignId}`
- Players join their campaign room on connection
- DM events broadcast to the campaign room
- Use `socket.to(room)` for broadcasts (excludes sender) or `io.in(room)` (includes sender)

## Server-Side Handlers
- Organize handlers in `server/src/socket/handlers/` — one file per domain (token, dice, chat, campaign)
- Register handlers in a central `server/src/socket/index.ts` setup function
- Always validate that the user has permission for the action (DM vs Player vs Observer)
- Wrap handler logic in try/catch — emit structured error events on failure

## Client-Side Hooks
- Create custom hooks per domain: `useTokenSocket()`, `useDiceSocket()`, `useChatSocket()`
- Always clean up listeners in the hook's cleanup function
- Use refs for socket instance to avoid re-registration on re-renders
