---
description: "Audit agent files for bloat and duplication against copilot-instructions. Removes redundant content from agent files only — all other files are read-only references."
---
Audit agent files for content that duplicates `copilot-instructions.md`, then propose cuts.

## Input

If the user provided a specific agent file (e.g., "run kill-bloat on `developer.md`"), scope the audit to **that one file only**. Otherwise, audit all files matching `.github/agents/*.md`.

## Scope

**Editable (may be modified):**
- The specified agent file, or `.github/agents/*.md` if none was specified

**Read-only references (read for comparison, never edit):**
- `.github/copilot-instructions.md` — the canonical source of truth
- `.github/prompts/*.prompt.md`

**Out of scope (never read or edit):**
- `.github/instructions/*.instructions.md`
- `.github/skills/*.skill.md`
- `.project/features/*.md`
- `.project/roadmap.md`, `.project/project-tree.md`, `.project/notes/`, `.project/handoffs/`, `.project/.archive/complete/`

## Detection Passes

### Pass 1: Agent ↔ copilot-instructions Duplication
Find content in agent files that restates what's already in `copilot-instructions.md`:
- Tech stack lists
- Feature slug → path tables
- Architecture/convention summaries
- Project structure info

For each duplicate, flag the **agent file copy** for removal. `copilot-instructions.md` is always the canonical source — never remove content from it.

### Pass 2: Stale References in Agent Files
- References in agent files to features, files, or patterns that **demonstrably** don't exist in the codebase
- Flag only — do not auto-cut; present for user review

### Pass 3: Internal Redundancy in Agent Files
- Content repeated **within the same agent file** (e.g., a table and prose that say the identical thing)
- Flag only — do not auto-cut; present for user review

> Passes 2–3 may **not** condense, shorten, or rewrite content. They only flag findings for the user to decide on.

## Output Format

Present findings grouped by pass, using this structure:

```
### Pass N: {Pass Name}

**{source-file.md}** ↔ **{other-file.md}**
- Lines/section duplicated: "{brief quote or description}"
- Canonical source: {file that should keep it}
- Action: Remove from {other file}
```

After all passes, provide:
1. **Total redundant lines** — estimated count of lines that can be cut
2. **Worst offenders** — top 3 files by redundancy volume (omit when auditing a single file)
3. **Proposed cuts** — a concrete list of deletions, grouped by file

## Rules

- Present the full report before making any changes
- Ask which cuts to apply (all, by pass, by file, or individually)
- **Only `.github/agents/*.md` files may be edited** — all other files are read-only or out of scope
- `copilot-instructions.md` is always the canonical source — never edit it
- When cutting, remove the agent file copy, not the original
- Do not rewrite or rephrase surviving content unless it becomes incoherent after a cut
- Preserve all YAML frontmatter — never touch `description` or `applyTo` fields

## Re-Run Safety

This prompt is designed for periodic use, not continuous trimming. These rules are **hard constraints**, not suggestions:

- **Only Pass 1 may produce deletions** — and only in agent files. Passes 2–3 are report-only; the user decides whether to act.
- **Only cut true duplicates** — content that exists verbatim (or near-verbatim) in `copilot-instructions.md`. If a concept appears only in the agent file, it is not bloat — leave it alone.
- **Never edit `copilot-instructions.md`** — it is the canonical source. Duplicates are removed from agent files, never from the source.
- **Never condense, shorten, or rephrase unique content** — if it's not duplicated in copilot-instructions, it stays as-is regardless of length or verbosity.
- **Protect cross-references** — If a prior run replaced content with a reference (e.g., "see `copilot-instructions.md` § X"), the referenced section is now load-bearing. Do not condense or remove it.
- **Zero findings is a valid result** — If no true duplication is found, report "No actionable findings" and stop. Do not invent cuts to justify running. This is the expected outcome on a healthy codebase.
