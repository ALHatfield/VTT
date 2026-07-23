---
description: "Scaffold a new Express API route with validation, auth middleware, and error handling."
agent: agent
argument-hint: "Resource name (e.g., campaigns, tokens)"
---
Create a new Express route file following the project conventions:

1. Create the route file in `server/src/features/{slug}/` (where `{slug}` is the feature this route belongs to)
2. Use `express.Router()` with `requireAuth` middleware applied at the router level
3. Add role-based middleware (`requireRole`) on routes that need DM-only access
4. Validate request bodies using Zod schemas from `shared/validators/`
5. Wrap all async handlers in try/catch with `next(err)` forwarding
6. Use the standard response format: `{ data: T }` for success, `{ error: { message, code } }` for errors
7. Add corresponding shared types in `shared/types/` for request/response payloads
