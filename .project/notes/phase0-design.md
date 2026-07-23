# Phase 0 Design: Foundation & Project Setup

> **Status:** Draft — awaiting approval  
> **Dependencies:** None  
> **Unlocks:** auth Phase 1A

---

## Architecture

Three npm workspaces in a single repo:

```
VTT-2/
├── client/          # workspace: "client"
├── server/          # workspace: "server"
└── shared/          # workspace: "@vtt/shared"
```

The root `package.json` defines workspaces and dev scripts. Each workspace has its own `tsconfig.json` and `package.json`. The `shared` package is consumed by both `client` and `server` via npm workspace linking (`@vtt/shared`).

**Dev flow:** `npm run dev` starts both client (Vite on `:5173`) and server (Express on `:3001`) concurrently. Vite proxies `/api` and `/socket.io` requests to the Express server.

---

## Deliverables

### 1. Root workspace config

**`package.json`** (root):
- Workspaces: `["client", "server", "shared"]`
- Scripts: `dev`, `dev:client`, `dev:server`, `build`, `test`, `db:migrate`, `db:seed`, `db:studio`
- Dev dep: `concurrently` (for running client + server together)

**`.gitignore`** (root):
- `node_modules`, `dist`, `build`, `.env*`, coverage, logs, OS files

### 2. Vite + React 18 + TypeScript (client)

**`client/package.json`**:
- Deps: `react@^18`, `react-dom@^18`, `react-router-dom@^6`
- Dev deps: `vite@^6`, `@vitejs/plugin-react@^4`, `typescript@^5`, `@types/react@^18`, `@types/react-dom@^18`

**`client/tsconfig.json`**:
- `strict: true`, target `ES2020`, `jsx: react-jsx`
- `moduleResolution: bundler`
- Path alias: `@/*` → `src/*`
- References `shared/` via workspace dep

**`client/vite.config.ts`**:
- React plugin
- Path alias `@/` → `./src`
- CSS Modules enabled (built-in, no config needed)
- Proxy: `/api` → `http://localhost:3001`, `/socket.io` → `http://localhost:3001` (with `ws: true`)
- Server port: `5173` (Vite default)

**`client/index.html`** + **`client/src/main.tsx`** + **`client/src/App.tsx`**:
- Minimal shell: `<App />` wrapped in `<BrowserRouter>`
- App renders a placeholder `<h1>VTT</h1>` — features come in Phase 1A+

**Folder scaffolding** (empty directories with `.gitkeep`):
```
client/src/
├── features/
│   ├── auth/
│   ├── campaigns/
│   ├── play-area/
│   ├── editor/
│   └── characters/
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── context/
│   ├── styles/
│   └── utils/
└── App.tsx
```

### 3. Express + TypeScript (server)

**`server/package.json`**:
- `"type": "module"` (ESM)
- Deps: `express@^4`, `cors`, `socket.io@^4`, `dotenv`, `zod`
- Dev deps: `typescript@^5`, `tsx`, `@types/express`, `@types/cors`, `@types/node`
- Scripts: `dev` (`tsx watch src/app.ts`), `build` (`tsc`), `start` (`node dist/app.js`)

**`server/tsconfig.json`**:
- `strict: true`, target `ES2020`, module `ES2020`
- `moduleResolution: node16` (proper ESM resolution)
- `outDir: ./dist`, `rootDir: ./src`
- Path alias: `@/*` → `src/*`

**`server/src/app.ts`** (entry point):
- Load env vars → validate with Zod → create Express app → attach middleware → create HTTP server → attach Socket.IO → listen
- Middleware stack: `cors`, `express.json()`, `express.urlencoded()`
- Health check: `GET /health`
- Error handling middleware (last in chain)
- Port: `3001`

**Folder scaffolding** (empty directories with `.gitkeep`):
```
server/src/
├── features/
│   ├── auth/
│   ├── campaigns/
│   ├── play-area/
│   ├── editor/
│   └── characters/
├── shared/
│   ├── middleware/
│   ├── socket/
│   ├── db/
│   └── utils/
└── app.ts
```

### 4. Prisma + PostgreSQL

**`server/prisma/schema.prisma`**:
- Datasource: `postgresql`, env `DATABASE_URL`
- Generator: `prisma-client-js`
- No models yet — Phase 1A adds the User model
- Uses `@@map` convention per database instructions

**`server/src/shared/db/prisma.ts`** (singleton):
```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export { prisma };
```

### 5. Shared types package (`@vtt/shared`)

**`shared/package.json`**:
- Name: `@vtt/shared`
- Main: `./src/index.ts` (consumed directly as TS — no build step needed with workspace linking)
- No runtime deps

**`shared/tsconfig.json`**:
- `strict: true`, `composite: true` (for project references)

**`shared/src/index.ts`** — barrel export:
```ts
export * from './types';
export * from './constants';
export * from './validators';
```

**Folder scaffolding:**
```
shared/src/
├── types/
│   └── index.ts
├── constants/
│   └── index.ts
├── validators/
│   └── index.ts
└── index.ts
```

### 6. Vitest config

**Root `vitest.workspace.ts`**:
- Defines workspace projects: `client`, `server`, `shared`

**`client/vitest.config.ts`**:
- Environment: `jsdom`
- Globals: true
- Resolve path aliases

**`server/vitest.config.ts`**:
- Environment: `node`
- Globals: true

**`shared/vitest.config.ts`**:
- Environment: `node`
- Globals: true

Dev deps at root: `vitest@^3`, `@vitest/coverage-v8`  
Dev dep in client: `jsdom`

### 7. ESLint + Prettier

**Root `eslint.config.js`** (flat config, ESLint v9):
- TypeScript parser
- Recommended rules + React hooks rules
- No `any` enforcement

**Root `.prettierrc`**:
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true
}
```

Dev deps at root: `eslint@^9`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `prettier`

### 8. CSS Modules + global style variables

**`client/src/shared/styles/variables.css`**:
```css
:root {
  /* Colors — dark fantasy theme */
  --color-bg-primary: #1a1a2e;
  --color-bg-secondary: #16213e;
  --color-bg-surface: #0f3460;
  --color-text-primary: #e8e8e8;
  --color-text-secondary: #a8a8b8;
  --color-accent: #e94560;
  --color-accent-hover: #ff6b81;
  --color-success: #2ed573;
  --color-warning: #ffa502;
  --color-error: #ff4757;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.5rem;

  /* Borders & Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.5);
}
```

**`client/src/shared/styles/global.css`**:
- Reset (`*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`)
- Body defaults using CSS variables
- Imports `variables.css`

Imported once in `main.tsx`. All component styles use CSS Modules.

### 9. Dev scripts

Root `package.json` scripts:

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `concurrently "npm run dev:client" "npm run dev:server"` | Start both |
| `dev:client` | `npm run dev -w client` | Vite dev server |
| `dev:server` | `npm run dev -w server` | tsx watch server |
| `build` | `npm run build -w shared && npm run build -w server && npm run build -w client` | Build all |
| `test` | `vitest` | Run all tests (workspace mode) |
| `db:migrate` | `npx prisma migrate dev --schema=server/prisma/schema.prisma` | Prisma migrate |
| `db:seed` | `npx prisma db seed --schema=server/prisma/schema.prisma` | Prisma seed |
| `db:studio` | `npx prisma studio --schema=server/prisma/schema.prisma` | Prisma GUI |

### 10. Environment variable validation (Zod)

**`server/src/shared/utils/env.ts`**:
```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = validateEnv();
```

**`server/.env.example`**:
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vtt_dev
ALLOWED_ORIGINS=http://localhost:5173
SESSION_SECRET=change-me-to-a-random-string-at-least-32-chars
```

### 11. Error handling middleware

**`server/src/shared/middleware/error-handler.ts`**:
```ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Express error middleware (4-arg signature)
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code, details: err.details },
    });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
  });
}
```

**`server/src/shared/utils/async-handler.ts`**:
```ts
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
```

### 12. GSAP + @gsap/react setup

Client deps: `gsap@^3`, `@gsap/react@^2`

**`client/src/shared/utils/gsap-config.ts`**:
```ts
import gsap from 'gsap';
// Register additional plugins here as needed (ScrollTrigger, Flip, etc.)
export { gsap };
```

Imported once in `main.tsx`.

---

## Decisions & Trade-offs

| Decision | Choice | Alternative Considered | Rationale |
|----------|--------|----------------------|-----------|
| Dev runner | `tsx watch` | `nodemon` + `ts-node` | Faster (esbuild), single dep, works with ESM |
| Concurrency | `concurrently` | `npm-run-all` | Cross-platform, color-coded output, used in prior project |
| Client port | `5173` | `3000` | Vite default |
| Server port | `3001` | `3000` | Same as prior project, keeps API separate |
| ESM | `"type": "module"` | CommonJS | Modern, tree-shakeable, prior project already on ESM |
| CSS variables | Dark theme | Light theme | Better for VTT — dark UIs reduce eye strain |
| Env validation | Zod at startup | `dotenv` only | Fail-fast on missing config |
| Auth strategy | Sessions (future) | JWT | Per project spec — session-based with secure cookies |
| Prisma singleton | `shared/db/prisma.ts` | Per-request client | Per database instructions |
| Shared pkg build | None (TS source) | Build to JS | Vite and tsx handle TS directly |

---

## Exclusions

Phase 0 intentionally does NOT include:
- User model (Phase 1A: auth)
- Session middleware (Phase 1A: auth)
- Socket.IO room logic (Phase 3A: play-area)
- PixiJS setup (Phase 3A: play-area)
- Any component beyond the placeholder App

---

## File Manifest

```
VTT-2/
├── package.json
├── .gitignore
├── vitest.workspace.ts
├── eslint.config.js
├── .prettierrc
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── App.module.css
│       ├── shared/
│       │   ├── styles/
│       │   │   ├── variables.css
│       │   │   └── global.css
│       │   ├── components/.gitkeep
│       │   ├── hooks/.gitkeep
│       │   ├── context/.gitkeep
│       │   └── utils/
│       │       └── gsap-config.ts
│       └── features/
│           ├── auth/.gitkeep
│           ├── campaigns/.gitkeep
│           ├── play-area/.gitkeep
│           ├── editor/.gitkeep
│           └── characters/.gitkeep
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── .env.example
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── app.ts
│       ├── shared/
│       │   ├── middleware/
│       │   │   └── error-handler.ts
│       │   ├── socket/.gitkeep
│       │   ├── db/
│       │   │   └── prisma.ts
│       │   └── utils/
│       │       ├── env.ts
│       │       └── async-handler.ts
│       └── features/
│           ├── auth/.gitkeep
│           ├── campaigns/.gitkeep
│           ├── play-area/.gitkeep
│           ├── editor/.gitkeep
│           └── characters/.gitkeep
└── shared/
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    └── src/
        ├── index.ts
        ├── types/
        │   └── index.ts
        ├── constants/
        │   └── index.ts
        └── validators/
            └── index.ts
```

---

## Post-Build Verification

After implementation, verify:

1. `npm install` — installs all workspace dependencies
2. Create PostgreSQL database `vtt_dev`
3. `cp server/.env.example server/.env` and fill in values
4. `npm run db:migrate` — Prisma initializes
5. `npm run dev` — client on `:5173`, server on `:3001`
6. `GET http://localhost:3001/health` → `{ status: 'ok' }`
7. `npm test` — Vitest runs (no tests yet, config is valid)
