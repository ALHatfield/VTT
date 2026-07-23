# VTT — Virtual Tabletop

A browser-based platform for playing TTRPGs online. Real-time shared canvas with maps, tokens, character sheets, and dice rolling.

## Quick Start

```bash
npm install              # Install all workspace dependencies
npm run db:migrate       # Run Prisma migrations
npm run db:seed          # Seed pre-configured user accounts
npm run dev              # Start client + server in dev mode
npm run test             # Run Vitest across all packages
npm run phase:start -- --slug campaigns           # Prep a phase (context + ports)
npm run phase:prep -- --slug campaigns            # Load slug context and check required ports
npm run phase:verify -- --target full             # Run standard verification checks
npm run phase:finish -- --slug campaigns --phase 3B --target full  # Verify + docs sync + tree sync (dry-run writes by default)
npm run docs:check                                 # Validate docs coverage and references
npm run docs:sync-phase -- --slug campaigns --dry-run  # Dry-run docs archive + doc checks
```

Other useful commands:

```bash
npm run dev:client       # Start Vite dev server only
npm run dev:server       # Start Express server only
npm run db:studio        # Open Prisma Studio (visual DB browser)
npm run build            # Build all packages
npm run phase:verify -- --target client           # Lint + test client only
npm run phase:verify -- --target server           # Lint + test server only
npm run phase:prep -- --slug auth --kill-ports    # Prep context and free required ports
npm run phase:finish -- --slug auth --phase 1A --modified server/src/features/auth/auth.routes.ts,client/src/features/auth/Login.tsx --write-docs
npm run docs:check -- --slug auth --strict        # Fail on warnings for a specific feature
```

## Phase Workflow Automation

Recommended command flow for feature-phase work:

```bash
npm run phase:start -- --slug campaigns
npm run phase:verify -- --target server
npm run phase:finish -- --slug campaigns --phase 3B --modified server/src/features/campaigns/campaigns.routes.ts,client/src/features/campaigns/CampaignList.tsx --target server
```

Notes:

- `phase:finish` runs docs sync and project tree sync in dry-run mode by default. Add `--write-docs` to apply writes.
- Pass `--phase <id>` and `--modified path1,path2,...` so tree markers are auto-applied for that phase.
- If verify fails (lint, typecheck, tests), finish stops before docs sync. Fix verification issues first.

## Project Structure

Code is organized by **feature**, not file type. Each feature has its own directories, instruction files, docs, and shared types — all derived from a single slug:

| Slug | What |
|------|------|
| `auth` | Authentication, sessions, route protection |
| `campaigns` | Campaign CRUD, roles, invites |
| `play-area` | Canvas, tokens, dice, chat, fog of war, initiative |
| `editor` | Scene editor, asset library, layers |
| `characters` | Character sheets, stats, inventory |

Given a slug, all paths are predictable:

```
client/src/features/{slug}/                            # Client code
server/src/features/{slug}/                            # Server code
shared/types/{slug}.ts                                 # Shared types
shared/validators/{slug}.ts                            # Zod schemas
shared/constants/{slug}.ts                             # Constants & event names
.project/features/{slug}.md                            # Phase tracking & decisions
.github/instructions/feature-{slug}.instructions.md   # Copilot rules
```

---

## How the `.github/` System Works

The `.github/` directory contains three types of Copilot customization files that shape how AI assists you in this project:

```
.github/
├── copilot-instructions.md      # Global project context (always loaded)
├── instructions/                # Auto-loaded rules based on file being edited
├── agents/                      # Specialized agent modes for Chat
└── prompts/                     # Reusable prompt shortcuts
```

### Instructions (auto-loaded context)

Files in `.github/instructions/` load automatically based on the file you're editing. Each has an `applyTo` glob pattern — when you edit a matching file, those rules are injected into Copilot's context. **No manual steps needed.**

| Instruction File | Loads When Editing |
|---|---|
| `coding-standards.instructions.md` | Any file (`**`) |
| `feature-{slug}.instructions.md` | Files in `**/features/{slug}/**` |
| `api-routes.instructions.md` | Files in `server/**/features/**` |
| `react-components.instructions.md` | Client `.tsx` files |
| `gsap-animations.instructions.md` | Client `.tsx` files |
| `canvas.instructions.md` | Play-area or editor feature files |
| `websocket-events.instructions.md` | Socket or play-area files |
| `database.instructions.md` | Files in `**/prisma/**` |
| `testing.instructions.md` | Test files (`**/*.test.*`) |

### Agents (specialized Chat modes)

Agents are specialized personas you switch to in VS Code Chat. Each is tuned for a specific job with its own system prompt, constraints, and tool access.

**How to use:** In VS Code Chat, click the agent/mode selector (top of the chat panel) and pick the agent you want. Then type your request.

| Agent | When to Use |
|---|---|
| **`developer`** | **Primary workflow agent.** Building a feature phase end-to-end. Give it a slug and phase (e.g., "Build auth phase 1A") and it handles the full lifecycle: reads requirements, implements code in the correct order, runs tests, does a self-review, asks for your sign-off, then updates all documentation. |
| **`architect`** | Planning phases, designing data models, defining API or Socket.IO contracts, making technology decisions, resolving cross-feature dependencies, or evaluating scalability/security trade-offs. |
| **`code-reviewer`** | Reviewing a file, function, or PR for correctness, security, coding standards, feature boundary violations, and performance. Read-only — it flags issues but doesn't fix them. |
| **`docs-keeper`** | Auditing documentation. Compares feature docs, roadmap, project tree, and instructions against the actual codebase. Finds stale statuses, structural drift, and cross-document inconsistencies. |
| **`security`** | Security audits — OWASP Top 10, auth/session/role patterns, dependency CVEs, API and Socket.IO endpoint hardening. Only flags and fixes security issues, not style. |

### Prompts (reusable shortcuts)

Prompts are quick-action templates you invoke from Chat. They run a specific, scoped task without switching agent modes.

**How to use:** In VS Code Chat, type `/` to see available prompts, then select one and provide the argument.

| Prompt | What It Does | Example |
|---|---|---|
| `/next-phase` | Analyzes the dependency graph and feature statuses. Reports what's in progress, what's ready to build, and what's blocked. Recommends the next phase. | `/next-phase` |
| `/update-feature` | Quick sync — scans the codebase and updates a feature doc's task checkboxes and phase statuses. Does NOT do full documentation (use the `developer` agent for that). | `/update-feature auth` |
| `/create-feature` | Scaffolds a complete new feature — instruction file, feature doc, shared types, directories, and registry updates. Walks you through the setup interactively. | `/create-feature inventory` |
| `/create-component` | Scaffolds a React component with a co-located CSS Module following project conventions. | `/create-component TokenCard` |
| `/create-api-route` | Scaffolds an Express route file with validation, auth middleware, and error handling. | `/create-api-route tokens` |
| `/create-tests` | Generates Vitest tests for the specified file or function. Covers happy paths, edge cases, and error scenarios. | `/create-tests server/src/features/auth/routes.ts` |
| `/sync-tree` | Regenerates `.project/project-tree.md` from the filesystem while preserving existing phase markers on unchanged paths. | `/sync-tree` |
| `/docs-audit` | Runs a three-pass documentation audit (structure, cross-document consistency, implementation sync) and reports drift before changes. | `/docs-audit` |
| `/note` | Captures implementation ideas into `.project/notes/{slug}-{topic}.md` and links them to feature phases when possible. | `/note play-area token-snapping — snap tokens to grid intersections` |
| `/kill-bloat` | Audits context files (agent files, prompt files) for duplicated or redundant content. Reports findings and proposes cuts before touching anything. | `/kill-bloat` |

---

## Development Workflow

### Starting a new phase

1. **Find what to build next:**
   ```
   /next-phase
   ```
   This reads the roadmap and feature docs, resolves the dependency graph, and tells you what's unblocked.

2. **Switch to the `developer` agent** in Chat and tell it what to build:
   ```
   Build auth phase 1A
   ```
   The developer agent will:
   - Read the feature doc and instructions
   - Implement code in the correct order (types → validators → schema → server → client → tests)
   - Run the test suite
   - Self-review via the `code-reviewer` agent
   - Present you with a summary and ask for sign-off
   - After your approval, update all documentation (feature doc, roadmap, phase record, project tree)

3. **Review and approve** — the agent won't update docs until you confirm.

### While coding manually

Copilot context loads automatically. Just edit files and the relevant instruction files kick in — feature rules, coding standards, API conventions, etc.

Use the scaffolding prompts to save time:
- `/create-component` for new React components
- `/create-api-route` for new Express routes
- `/create-tests` for test files

### After completing work outside the developer agent

If you built something manually or with regular Copilot (not the developer agent), sync the feature doc:
```
/update-feature auth
```
This only updates task checkboxes and phase statuses in the feature doc. For full documentation (phase records, roadmap, project tree), use the `developer` agent's documentation phase.

### Periodic maintenance

- **Docs audit:** Switch to the `docs-keeper` agent. It compares all docs against the codebase and flags drift.
- **Context bloat:** Run `/kill-bloat`. Audits context files for duplication and redundancy, proposes cuts before making any changes.
- **Security audit:** Switch to the `security` agent. Point it at a feature or the whole codebase.
- **Architecture review:** Switch to the `architect` agent for design decisions, dependency questions, or planning.

---

## Docs

- [`.project/roadmap.md`](.project/roadmap.md) — Master overview, dependency graph, feature status table
- [`.project/features/`](.project/features/) — Per-feature phases, tasks, and decisions
- [`.project/project-tree.md`](.project/project-tree.md) — Intended file structure (kept in sync by the developer agent)
- [`.project/.archive/complete/`](.project/.archive/complete/) — Phase completion records with deliverables and test results
- [`.project/notes/`](.project/notes/) — Development notes, research, and lessons learned
