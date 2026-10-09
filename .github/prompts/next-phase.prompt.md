---
description: "Analyze the dependency graph and feature statuses to recommend which phase to build next."
agent: agent
---
Determine the next phase(s) available for development.

## Steps

1. **Run the analyzer** — execute `npm run project:graph` in the terminal. It parses the roadmap Mermaid graph, cross-references feature doc statuses and archive records, and outputs: in-progress, unblocked, blocked, deferred, critical path, and a recommended next phase.
2. **Reformat the output** for the user:

```
## In Progress
- {slug} Phase {id}: {name} — {summary of remaining tasks}

## Ready to Build (all dependencies met)
- {slug} Phase {id}: {name} — depends on: {list of completed dependencies}
- ...

## Blocked (dependencies not yet complete)
- {slug} Phase {id}: {name} — waiting on: {list of incomplete dependencies}
- ...

## Deferred (intentionally sidelined)
- {slug} {id}: {name}, {slug} {id}: {name}, ... (single line, no detail)
```

3. **Present the recommendation** from the script's `RECOMMENDED NEXT` section. For in-progress phases, read the feature doc in `.project/features/{slug}.md` to summarize remaining tasks.
4. **Sanity-check** — if the script reports `VALIDATION ISSUES` or `UNTRACEABLE NODES`, surface them to the user as discrepancies.

## Rules

- Phase statuses live in feature doc Current Status tables (`Not Started`, `In Progress`, `Complete`, `Deferred`); archived completion records in `.project/.archive/complete/` confirm completed phases
- `Deferred` phases are never recommended, but still count as incomplete dependencies for downstream phases
- If the script fails or its output looks wrong, fall back to manually reading `.project/roadmap.md` and the feature docs, and flag the script issue
- Do not start building — only report and recommend
