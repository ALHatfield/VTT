# Phase 0: Foundation & Project Setup

> **Doc:** `.project/foundation.md`
> **Phase:** 0
> **Dependencies:** None

This is the project scaffolding phase. It creates the monorepo structure, installs core dependencies, and establishes the tooling that all features depend on. It is not a feature — it has no slug, no feature directories, and no instruction file.

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 0 | Foundation & Project Setup | Complete |

---

## Tasks

- [x] Initialize npm workspaces (client, server, shared)
- [x] Vite + React 18 + TypeScript (client)
- [x] Express + TypeScript (server)
- [x] Prisma + PostgreSQL setup, initial schema
- [x] Shared types package with workspace aliasing (`@vtt/shared`)
- [x] Vitest config for all packages
- [x] ESLint + Prettier config
- [x] CSS Modules + global style variables
- [x] Dev scripts (`npm run dev`, concurrent client + server)
- [x] Environment variable validation (Zod)
- [x] Error handling middleware (Express)
- [x] GSAP + @gsap/react setup

## Decisions

- Monorepo managed with npm workspaces (not Turborepo, nx, or pnpm)
- Shared package aliased as `@vtt/shared` for clean imports
- Prisma client instantiated as a singleton, not per-request
- Environment variables validated at startup with Zod — fail fast on missing config

## Dependencies Unlocked

When Phase 0 is complete, the following phases become available:
- `auth` Phase 1A (MVP Auth)
