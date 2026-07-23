---
description: "Conventions for Express API route handlers including validation, auth, and error handling."
applyTo: "server/**/features/**"
---
# API Route Conventions

## Route Structure
- One file per resource (e.g., `campaigns.ts`, `tokens.ts`, `characters.ts`)
- Use `express.Router()` and export the router instance
- Apply auth middleware at the router level, role middleware per route

```ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(requireAuth);

router.get('/:id', async (req, res, next) => {
  try {
    // handler logic
  } catch (err) {
    next(err);
  }
});

router.post('/:id/tokens', requireRole('dm'), async (req, res, next) => {
  try {
    // only DMs can add tokens
  } catch (err) {
    next(err);
  }
});

export { router as campaignRouter };
```

## Request Validation
- Validate request bodies and params at the route level using Zod schemas from `shared/validators/`
- Never trust client input — validate and sanitize on the server

## Response Format
- Success: `{ data: T }` with appropriate HTTP status (200, 201)
- Error: `{ error: { message: string, code: string } }` with appropriate HTTP status
- Use `204 No Content` for successful deletions

## Role-Based Access
- DM: Full CRUD on their own campaigns
- Player: Read campaign data, control their own token and character sheet
- Observer: Read-only access to play area data
- Always check resource ownership in addition to role — a DM can only edit *their* campaigns
