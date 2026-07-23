# Handoff — Notes & Handoffs Naming Convention

This document defines the naming and organization conventions for `.project/notes/` and `.project/handoffs/`, and the changes needed in `phase-context.mjs` and `developer.agent.md` to support phase-scoped context loading.

---

## Problem

The developer agent loads **all** `{slug}-*.md` notes for a feature regardless of which phase is being built. For features like `play-area` with 9+ note files spanning MVP through post-MVP, this wastes tokens on irrelevant context (e.g., loading fog rendering research when building NPC token subtypes).

---

## Folder Purposes

| Folder | Purpose | Contents |
|--------|---------|----------|
| `.project/notes/` | Knowledge generated **during** VTT development | Implementation research, lessons learned, debugging notes, design explorations |
| `.project/handoffs/` | Knowledge **imported from outside** the VTT project | External project documentation, prior-art analysis, reference implementations |

---

## Naming Convention

Both folders use the same filename pattern:

```
{slug}-{phase}-{topic}.md      ← loaded only when building that phase
{slug}-general-{topic}.md      ← loaded for ALL phases of that slug
{topic}.md                     ← cross-feature (no slug prefix), loaded on demand
```

### Rules

1. **`{slug}`** matches the feature slug exactly (`play-area`, `auth`, `campaigns`, `characters`, `editor`, `portal`)
2. **`{phase}`** matches the phase ID from the feature doc (`4A`, `4F`, `4F.2`, `PM1`, `PM2`, etc.) — case-sensitive, dot-separated sub-phases allowed
3. **`{topic}`** is a short kebab-case description of the note's subject
4. Files without a slug prefix are cross-feature — the context loader does not auto-load them; they must be referenced explicitly
5. `general` is a reserved keyword — never use it as a phase ID

### Examples

```
notes/play-area-4F-fog-compositing.md         ← loaded for any 4F.x phase
notes/play-area-PM2-fog-rendering.md          ← loaded only for PM2
notes/play-area-general-pixijs-v8.md          ← loaded for all play-area phases
notes/vitest-parallel-port-conflict.md        ← cross-feature, not auto-loaded
handoffs/play-area-PM1-3d-dice-roller.md      ← loaded only for PM1
```

### Phase prefix matching

A note with phase `4F` matches phases `4F`, `4F.1`, `4F.2`, `4F.3`, etc. A note with phase `4F.2` matches only `4F.2`. This allows broader notes to cover an entire phase family while specific notes target a single sub-phase.

---

## Rename Plan (Existing Files)

### notes/

| Current filename | New filename | Phase scope |
|-----------------|-------------|-------------|
| `play-area-fog-compositing.md` | `play-area-4F-fog-compositing.md` | 4F.x |
| `play-area-seed-scene-idempotency.md` | `play-area-general-seed-scene-idempotency.md` | all play-area |
| `play-area-fog-rendering.md` | `play-area-PM2-fog-rendering.md` | PM2 |
| `play-area-line-of-sight.md` | `play-area-PM3-line-of-sight.md` | PM3 |
| `play-area-lighting-effects.md` | `play-area-PM4-lighting-effects.md` | PM4 |
| `play-area-environmental-effects.md` | `play-area-PM5-environmental-effects.md` | PM5 |
| `play-area-pixiejs-canvas-notes.md` | `play-area-general-pixiejs-canvas-notes.md` | all play-area |
| `play-area-pixijs-v8.md` | `play-area-general-pixijs-v8.md` | all play-area |
| `rbac-architecture.md` | `rbac-architecture.md` | no change (cross-feature) |
| `vitest-parallel-port-conflict.md` | `vitest-parallel-port-conflict.md` | no change (cross-feature) |
| `phase0-design.md` | `phase0-design.md` | no change (cross-feature) |

### handoffs/

| Current filename | New filename | Phase scope |
|-----------------|-------------|-------------|
| `play-area-PM1-3d-dice-roller.md` | already renamed | PM1 |

---

## Script Changes: `phase-context.mjs`

### New `--phase` argument

Accept an optional `--phase <id>` flag. When provided, filter notes and handoffs to only include:
- `{slug}-{phase}-*.md` — exact phase match
- `{slug}-{parentPhase}-*.md` — parent phase match (e.g., `4F` matches when building `4F.2`)
- `{slug}-general-*.md` — always included

When `--phase` is omitted, fall back to current behavior (load all `{slug}-*.md`).

### Load from both folders

The `listNoteFiles` function currently only searches `notes/`. Update it to also search `handoffs/` with the same filtering logic. Output both folders with distinct section labels (`Dev Note` vs `Handoff`).

### Pseudocode

```js
function shouldIncludeNote(filename, slug, phase) {
  if (!filename.startsWith(`${slug}-`)) return false;
  if (!phase) return true; // no phase filter, load all

  const afterSlug = filename.slice(slug.length + 1); // e.g. "PM2-fog-rendering.md"

  // Always include general notes
  if (afterSlug.startsWith('general-')) return true;

  // Extract the phase segment (everything before the second hyphen)
  const phaseMatch = afterSlug.match(/^([A-Za-z0-9.]+)-/);
  if (!phaseMatch) return false;

  const notePhase = phaseMatch[1];

  // Exact match: note is "4F.2", building "4F.2"
  if (notePhase === phase) return true;

  // Parent match: note is "4F", building "4F.2"
  if (phase.startsWith(notePhase + '.')) return true;

  return false;
}
```

---

## Agent Changes: `developer.agent.md`

### Current rule
```
ALWAYS read `.project/notes/{slug}-*.md` if notes exist for the current slug
```

### New rule
```
ALWAYS read `.project/notes/{slug}-{phase}-*.md`, `.project/notes/{slug}-general-*.md`,
`.project/handoffs/{slug}-{phase}-*.md`, and `.project/handoffs/{slug}-general-*.md`
if notes exist for the current slug — parent-phase notes also apply
(e.g., `4F-*` notes load when building phase `4F.2`)
```

### Context Loading section update

Update the `phase:context` invocation to pass `--phase`:

```
Run `npm run phase:context -- --slug {slug} --phase {id} --exemplar campaigns`
```

---

## Feature Doc `Notes:` References

Phase sections in feature docs (e.g., `play-area.md`) that reference notes should use the full relative path:

```markdown
**Notes:** .project/notes/play-area-PM2-fog-rendering.md
**Notes:** .project/handoffs/play-area-PM1-3d-dice-roller.md
```

This makes the reference unambiguous and clickable in editors.

---

## Definition of Done

- [ ] `.project/handoffs/` folder exists with README or initial handoff file
- [ ] Existing handoff files moved from `notes/` to `handoffs/` with new naming
- [ ] Existing note files renamed to include phase or `general` segment
- [ ] `phase-context.mjs` accepts `--phase` and filters both `notes/` and `handoffs/`
- [ ] `developer.agent.md` updated with new context loading rules
- [ ] Feature doc `Notes:` references updated to match new paths
- [ ] All existing note/handoff content preserved — no content changes, only renames
