# Development Notes

Development notes for research, lessons learned, and technical investigations. These are separate from phase completion records in `.project/phases/` — notes capture knowledge that may span multiple phases or inform future work.

## Naming Convention

`{slug}-{topic}.md`

- **`{slug}`** — the feature slug (`auth`, `campaigns`, `play-area`, `editor`, `characters`)
- **`{topic}`** — a short, descriptive name for the subject

Examples:
- `editor-grid-alignment-research.md`
- `play-area-websocket-sync-lesson.md`
- `characters-spell-slot-modeling.md`

## When to Create a Note

- You're researching an approach before implementation begins
- Development is paused while investigating a technical problem
- A significant lesson was learned that applies beyond the current phase
- Technical debt or rework was identified for a future phase

## How Notes Are Used

The developer agent checks `.project/notes/` for files matching the current feature slug before starting a phase. If you've done research on a feature, your notes will be loaded as context automatically.
