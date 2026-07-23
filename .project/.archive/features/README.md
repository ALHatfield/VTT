# Archived Feature Phases

This directory stores archived `## Phase ...` sections from `.project/features/*.md`.

## Why this exists

Feature roadmap files stay focused on active and upcoming work by moving fully completed phase details out of the primary feature docs.

## Source of truth

- Active planning: `.project/features/{slug}.md`
- Completion details: `.project/complete/{slug}-{phase}.md`
- Archived phase snapshots: `.project/.archive/features/{slug}/phase-{phase}.md`

## Automation

Use the root script to archive completed phases:

```bash
npm run docs:archive-phases
```

Optional flags:

- `--slug <slug>`: archive a single feature
- `--dry-run`: preview only
- `--force`: rebuild existing archive files
