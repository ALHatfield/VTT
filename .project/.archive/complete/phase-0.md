# Phase 0: Foundation & Project Setup

**Completed:** 2026-05-24  
**Feature:** Foundation (no slug)

## Deliverables

### Root
- `package.json` — workspace config, all dev scripts
- `.gitignore`
- `.prettierrc`
- `eslint.config.js` — ESLint v9 flat config, scoped TS + React hooks rules
- `vitest.config.ts` — root vitest config with `test.projects`
- `vitest.workspace.ts` — superseded by `vitest.config.ts` (cannot delete)

### `shared/` (`@vtt/shared`)
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/index.ts` — barrel export
- `src/types/index.ts` — placeholder
- `src/constants/index.ts` — placeholder
- `src/validators/index.ts` — placeholder

### `server/`
- `package.json`
- `tsconfig.json` — `module: node16`, `moduleResolution: node16`, no path aliases (use relative imports)
- `vitest.config.ts`
- `.env.example`
- `prisma/schema.prisma` — baseline (no models yet)
- `prisma/seed.ts` — placeholder seed
- `src/app.ts` — Express + Socket.IO entry point
- `src/shared/db/prisma.ts` — Prisma singleton
- `src/shared/utils/env.ts` — Zod env validation with dotenv loading
- `src/shared/utils/async-handler.ts` — Express async wrapper
- `src/shared/middleware/error-handler.ts` — AppError class + error middleware

### `client/`
- `package.json`
- `tsconfig.json`
- `tsconfig.node.json`
- `vite.config.ts` — React plugin, `@/` alias, dev proxy to `:3001`
- `vitest.config.ts`
- `index.html`
- `src/vite-env.d.ts` — Vite/CSS Module type declarations
- `src/main.tsx` — React root, BrowserRouter
- `src/App.tsx` — placeholder component
- `src/App.module.css`
- `src/shared/styles/variables.css` — CSS custom properties (dark VTT theme)
- `src/shared/styles/global.css` — reset + body defaults
- `src/shared/utils/gsap-config.ts` — GSAP plugin registration entry point

## Test Results

```
$ npm test -- --run

 RUN  v3.2.4 /Users/andrew.hatfield/Desktop/VTT-2

No test files found, exiting with code 1

|client|   include: **/*.{test,spec}.?(c|m)[jt]s?(x)
|server|   include: **/*.{test,spec}.?(c|m)[jt]s?(x)
|@vtt/shared|   include: **/*.{test,spec}.?(c|m)[jt]s?(x)
```

All three projects discovered. No tests exist yet (expected — features add them from Phase 1A onward).

TypeScript:
```
$ npm run lint -w server → SERVER OK
$ npm run lint -w client → CLIENT OK
```

Health check:
```
$ npm run dev:server  →  Server running on http://localhost:3001
$ curl http://localhost:3001/health
{"status":"ok","timestamp":"2026-05-24T00:52:50.660Z"}
```

## Decisions & Insights

- **Server path aliases removed**: `server/tsconfig.json` had `paths: { "@/*": ["src/*"] }` but with `module: node16` they're erased at compile time and break at runtime. Server code uses relative imports throughout. Only the client (Vite bundler) gets free alias rewriting.
- **`tsx watch` over nodemon**: tsx uses esbuild, no config needed, handles ESM natively.
- **`vitest.workspace.ts` superseded**: Vitest v3 deprecated `defineWorkspace`. Created `vitest.config.ts` with `test.projects` instead. The old file remains but is ignored.
- **Helmet added**: Security review flagged missing HTTP security headers. `helmet` added to server deps.
- **`details` hidden in production**: `AppError.details` is only forwarded to clients in non-production environments to avoid leaking internal state.
- **`process.env.NODE_ENV` in error-handler**: Used directly instead of importing `env` module to avoid coupling the middleware to Zod validation.

## Dependencies Unlocked

- `auth` Phase 1A (MVP Auth) — **now unblocked**
