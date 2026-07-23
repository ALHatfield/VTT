---
description: "Capture an idea or insight as a dev note tied to a feature slug. Creates or updates .project/notes/{slug}-{phase|general}-{topic}.md."
agent: agent
argument-hint: "{slug} {topic} — the idea to capture (e.g., 'play-area token-snapping — snap tokens to grid intersections')"
---
Capture a development idea, architectural insight, or implementation plan as a structured note in `.project/notes/`.

## Naming Convention

Notes use the pattern: `{slug}-{phase|general}-{topic}.md`

- **Phase-scoped**: `{slug}-{phase}-{topic}.md` — loaded only when building that phase (parent phases also match: `4F-*` loads for `4F.2`)
- **General**: `{slug}-general-{topic}.md` — loaded for ALL phases of that slug
- **Cross-feature**: `{topic}.md` — no slug prefix, not auto-loaded by context scripts

## Input Parsing

The user provides: `{slug} {topic} — {idea}` or a freeform description. Parse it into:

- **slug** — feature slug (`auth`, `campaigns`, `play-area`, `editor`, `characters`, `portal`) or a cross-cutting label
- **phase** (optional) — a phase ID like `4F`, `6A`, `PM2` that scopes the note; defaults to `general` if not provided
- **topic** — kebab-case topic name (e.g., `token-snapping`, `fog-rendering`)
- **idea** — the content to capture (may come from the argument, conversation context, or both)

If the slug or topic is ambiguous, ask the user to clarify. Check the valid slugs against `.project/features/` — if the slug doesn't match an existing feature, it's a cross-cutting note (still valid, just won't be auto-scoped to a feature).

## Steps

### 1. Determine the phase scope

If the user specified a phase ID, use it. Otherwise:

- Read `.project/features/{slug}.md` and check if there's an `In Progress` phase — if so, ask the user if the note is for that phase or general
- If no phase is specified and none is in progress, default to `general`

### 2. Check for existing notes

List `.project/notes/` and check if `{slug}-{phase|general}-{topic}.md` already exists.

- **If it exists**: Read it, then append the new idea as a new section — do NOT overwrite existing content.
- **If it doesn't exist**: Create a new file.

### 3. Write the note

For **new notes**, use this structure:

```markdown
# {slug}: {Topic Title}

**Created:** {YYYY-MM-DD}
**Affects:** {slug} feature{, other-slug feature if cross-cutting}

## Covers

- `{Phase ID}` in `.project/features/{slug}.md` (if phase-scoped)
- General {slug} architecture (if general)

## Purpose

{1-2 sentence summary of what this note captures and why it matters.}

## {Content sections}

{Organize the idea into logical sections with headers. Use the tone and depth of
existing notes in .project/notes/ as a guide — concrete enough to implement from,
not so long it becomes a spec.}
```

For **appending to existing notes**, add a horizontal rule (`---`) and a new dated section:

```markdown
---

## {New Section Title}

**Added:** {YYYY-MM-DD}

{Content}
```

### 4. Confirm

After writing, print:

```
Note saved: .project/notes/{slug}-{phase|general}-{topic}.md
Linked to: {slug} (Phase {id} if applicable)
The developer agent will pick this up when building {slug} phases.
```

## Rules

- Use the naming convention: `{slug}-{phase|general}-{topic}.md`
- Default to `general` when no phase is specified or determinable
- `general` is a reserved keyword — never use it as a phase ID
- Keep notes implementation-focused — capture the *how*, not just the *what*
- Include code snippets, API shapes, or architecture diagrams when the idea calls for them
- Do NOT create notes for trivial items that belong as tasks in the feature doc instead
- Do NOT duplicate content already in instruction files or feature docs — reference them instead
- If the idea conflicts with an existing decision in `.project/features/{slug}.md`, flag the conflict and ask the user how to proceed
