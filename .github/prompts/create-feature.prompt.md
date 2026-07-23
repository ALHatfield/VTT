---
description: "Scaffold a complete feature — instruction file, feature doc, shared types, feature directories, and project registry updates."
agent: agent
argument-hint: "Feature slug and description (e.g., 'inventory — Item management, loot tables, and equipment tracking')"
---
Create a new feature end-to-end. The user provides a **slug** and a short description of the feature domain. Use the existing features (auth, campaigns, play-area, editor, characters) as reference for structure and tone.

## Slug Convention (Important)

Use a **single-token lowercase slug**: `^[a-z][a-z0-9]*$`.

- Allowed: `inventory`, `party`, `market2`
- Not allowed: `party-manager`, `play-area`, `party_manager`, `Party`
- If the requested feature name is multi-word, derive a compact slug and keep the full phrase in the display name.
- Example: display name "Party Manager" -> slug `partymanager`

## Steps

### 1. Gather Context

Before scaffolding, ask the user (if not already provided):
- **Slug** — single-token lowercase identifier (e.g., `inventory`, `partymanager`)
- **Display name** — human-readable name for headings (e.g., "Inventory", "Party Manager")
- **One-line description** — for the instruction file frontmatter
- **Phase number prefix** — the next available number (check `.project/roadmap.md` feature status table)
- **Phases** — names and short descriptions of each phase (at minimum one)
- **Dependencies** — which existing feature phases must complete first
- **Does it use Socket.IO?** — determines whether to include real-time event conventions
- **Does it need Prisma models?** — determines whether to mention data models in tasks

### 2. Create the Instruction File

Create `.github/instructions/feature-{slug}.instructions.md` with this structure:

```markdown
---
description: "{One-line description}"
applyTo: "**/features/{slug}/**"
---
# Feature: {slug}

> For current phase status and tasks, see `.project/features/{slug}.md`

## Overview
{2-3 sentence description of what this feature domain covers and why it exists.}

## {Domain-specific sections}
{Add sections relevant to this feature — API endpoints, data model overview, 
role-based access rules, real-time events, UI patterns, etc. 
Follow the style of existing instruction files (feature-auth, feature-campaigns).}

## Prior Art (Project_Pathfinder)
{If applicable — check ~/Desktop/Project_Pathfinder for relevant patterns. 
If nothing relevant exists, omit this section.}

## Integration Points
{How this feature connects to other features — which features it depends on 
and which features depend on it. Use bullet points with bold feature names.}
```

### 3. Create the Feature Doc

Create `.project/features/{slug}.md` with this structure:

```markdown
# Feature: {display-name}

> **Slug:** `{slug}`
> **Feature dirs:** `client/src/features/{slug}/`, `server/src/features/{slug}/`
> **Instructions:** `.github/instructions/feature-{slug}.instructions.md`
> **Shared types:** `shared/types/{slug}.ts`

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| {N}A | {Phase name} | Not Started |
| {N}B | {Phase name} | Not Started |
{...one row per phase}

---

## Phase {N}A: {Phase Name}

**Dependencies:** {dependency list or "None"}

### Tasks
- [ ] {Task items — be specific and actionable}

### Decisions
- {Key architectural decisions for this phase}

---

{...repeat for each phase}

## Cross-Feature Dependencies

| Depends On | Why |
|-----------|-----|
| {slug} Phase {X} | {reason} |

| Depended On By | Why |
|---------------|-----|
| {slug} Phase {X} | {reason} |

---

## Architectural Decisions (from Project_Pathfinder)

**What worked well:**
- {patterns worth keeping}

**What we're changing:**
- {patterns we're improving}
```

### 4. Scaffold Feature Directories

**Client** (`client/src/features/{slug}/`):
- `components/` with an `index.ts` barrel file
- `hooks/` directory
- `context/` — feature-specific React context (if needed)
- `utils/` — feature-specific utilities
- `types.ts` — imports shared types from `@vtt/shared`

**Server** (`server/src/features/{slug}/`):
- `routes.ts` — Express router stub with `requireAuth` middleware
- `service.ts` — service class stub
- `types.ts` — server-side type extensions

**Tests**:
- `client/src/features/{slug}/__tests__/` directory
- `server/src/features/{slug}/__tests__/` directory

### 5. Create Shared Artifacts

- `shared/types/{slug}.ts` — export placeholder interfaces for API and Socket.IO payloads
- `shared/validators/{slug}.ts` — export placeholder Zod schemas (import from `zod`)
- `shared/constants/{slug}.ts` — export placeholder constants (event names if real-time)

### 6. Update Project Registry

**`.project/roadmap.md`:**
- Add a row to the "Feature Status" table
- Add nodes to the Mermaid dependency graph
- Add a link in the "Feature Docs" list

**`.github/copilot-instructions.md`:**
- Add a row to the "Feature Naming Convention" table

**`.project/project-tree.md`:**
- Add all newly created directories and files to the tree
- This file must always reflect the actual filesystem

## Rules

- Follow all conventions from `coding-standards.instructions.md`
- Use named exports only — no default exports
- Use TypeScript strict mode in all generated files
- Match the tone and structure of existing feature files — read `feature-auth.instructions.md` and `.project/features/auth.md` as reference
- Do NOT modify existing feature files — only add new files and append to registry documents
- Phase numbers must not conflict with existing features (check `.project/roadmap.md`)
