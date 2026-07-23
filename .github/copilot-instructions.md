# Project Guidelines

## Overview
VTT (Virtual Tabletop) — a browser-based platform for playing TTRPGs like D&D and Pathfinder online. Features a real-time shared canvas with dynamic maps, tokens, character sheets, and integrated dice rolling.

## Documentation
- `.project/roadmap.md` — Master overview, dependency graph, Phase 0 tasks
- `.project/project-tree.md` — Complete file structure (updated per phase)
- `.project/.archive/complete/` — Phase completion records with deliverables and test results
- `.project/.archive/features/` — Archived completed phase sections from feature roadmaps
- `.project/notes/` — Development notes, research, and lessons learned (named `{slug}-{phase|general}-{topic}.md`)
- `.project/handoffs/` — External knowledge imported into the project (same naming convention as notes)
- `.project/features/{slug}.md` — Per-feature phases, tasks, and decisions

## Tech Stack
- **Frontend**: React 18+ with Vite, CSS Modules for styling, PixiJS for WebGL canvas rendering, Three.js with cannon-es for 3D dice rolling, GSAP for UI animations
- **Backend**: Node.js with Express, Socket.IO for real-time WebSocket communication
- **Database**: PostgreSQL with Prisma ORM
- **Language**: TypeScript (strict mode) across all packages
- **Testing**: Vitest
- **Monorepo**: npm workspaces

## Project Structure (Feature-Based)

Feature-based monorepo — see `.project/project-tree.md` for the full tree.

| Package | Purpose | Key Paths |
|---------|---------|-----------|
| `client/` | React (Vite) frontend | `src/features/` — feature modules, `src/shared/` — cross-cutting code |
| `server/` | Express + Socket.IO backend | `src/features/` — mirrors client, `prisma/` — schema & migrations |
| `shared/` | Code shared across client + server | `src/types/`, `src/constants/`, `src/validators/` |

## Build and Test
```bash
npm install              # Install all workspace dependencies
npm run dev              # Start client + server in dev mode
npm run dev:client       # Start Vite dev server only
npm run dev:server       # Start Express server with ts-node/nodemon
npm run build            # Build all packages
npm run test             # Run Vitest across all packages
npm run db:migrate       # Run Prisma migrations
npm run db:seed          # Seed pre-configured user accounts
npm run db:studio        # Open Prisma Studio
```

## Architecture

### User Roles
Three roles: **DM** (full control), **Player** (own token + sheet), **Observer** (read-only). See `feature-campaigns.instructions.md` for details.

### Canvas Layer System (PixiJS)
Three-layer PixiJS canvas: Background → Playground → Foreground. See `canvas.instructions.md` for details.

### Real-time Communication (Socket.IO)
Server is source of truth — clients send intents, server validates and broadcasts via Socket.IO rooms. See `websocket-events.instructions.md` for conventions.

### Authentication (MVP)
Pre-seeded accounts, session-based auth. See `feature-auth.instructions.md` for details.

## Conventions
- All shared types between client and server live in `shared/` — never duplicate type definitions
- Feature code stays inside its feature directory — avoid cross-feature imports (use `shared/` instead)
- Environment variables are validated at startup using Zod schemas

### Feature Naming Convention
Each feature has a **slug** used consistently across the entire project:

| Slug | Feature Dirs | Instructions | Docs | Shared Types |
|------|-------------|-------------|------|--------------|
| `auth` | `features/auth/` | `feature-auth.instructions.md` | `features/auth.md` | `types/auth.ts` |
| `portal` | `features/portal/` | `feature-portal.instructions.md` | `features/portal.md` | N/A |
| `campaigns` | `features/campaigns/` | `feature-campaigns.instructions.md` | `features/campaigns.md` | `types/campaigns.ts` |
| `play-area` | `features/play-area/` | `feature-play-area.instructions.md` | `features/play-area.md` | `types/play-area.ts` |
| `editor` | `features/editor/` | `feature-editor.instructions.md` | `features/editor.md` | `types/editor.ts` |
| `characters` | `features/characters/` | `feature-characters.instructions.md` | `features/characters.md` | `types/characters.ts` |
