---
description: "Use when writing, reviewing, or modifying code to follow project coding standards and style conventions."
applyTo: "**"
---
# Coding Standards

These are baseline standards for the whole repository. When a more specific instruction file applies, follow the more specific file.

## TypeScript
- Strict mode enabled (`strict: true` in tsconfig)
- Enable `noImplicitReturns: true` to enforce explicit returns on all code paths
- Use `interface` for object shapes, `type` for unions/intersections/utility types
- Exported functions must have explicit return types
- Use `const` by default, `let` only when reassignment is necessary, never `var`
- Prefer nullish coalescing (`??`) and optional chaining (`?.`) over manual null checks
- Avoid explicit `any`; use `unknown` for unknown shapes, then narrow with type guards

## Naming
- **Files**: `kebab-case.ts` for utilities, `PascalCase.tsx` for React components
- **Components**: PascalCase (`TokenLayer`, `DiceRoller`)
- **Functions/variables**: camelCase (`rollInitiative`, `currentPlayer`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_PLAYERS`, `DEFAULT_GRID_SIZE`)
- **Types/Interfaces**: PascalCase with descriptive names (`CampaignCreatePayload`, `TokenPosition`)
- **Event names**: colon-delimited lowercase (`campaign:token:move`)

## Imports
Order imports in this sequence, separated by blank lines:
1. Node built-ins (`node:path`, `node:fs`)
2. External packages (`react`, `express`, `socket.io`)
3. Shared workspace imports (workspace aliases such as `@vtt/shared`)
4. Internal absolute imports (package aliases such as `@/components`, `@/hooks`)
5. Relative imports (`./utils`, `../types`)

## Error Handling
- Never swallow errors silently — always log or re-throw
- Use custom error classes that extend `Error` for domain-specific errors
- Express routes: wrap async handlers to forward errors to the error middleware
- Socket.IO handlers: emit error events back to the client with structured error payloads
- Use early returns to handle error cases before the happy path

## General
- Prefer named exports over default exports
- Keep functions small and single-purpose
- No magic numbers — extract to named constants
- Delete dead code, don't comment it out
