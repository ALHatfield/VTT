---
description: "Analyze the dependency graph and feature statuses to recommend which phase to build next."
agent: agent
---
Determine the next phase(s) available for development.

## Steps

1. **Read the roadmap** at `.project/roadmap.md` — parse the Feature Status table and the Mermaid dependency graph
2. **Read each feature doc** in `.project/features/` — check the Current Status table for each phase's actual status (`Not Started`, `In Progress`, `Complete`)
3. **Resolve the dependency graph** — for every phase marked `Not Started`, check whether all of its upstream dependencies are `Complete`. If they are, that phase is **unblocked**.
4. **Check for in-progress work** — any phase marked `In Progress` takes priority over unblocked `Not Started` phases
5. **Present the results** in this format:

```
## In Progress
- {slug} Phase {id}: {name} — {summary of remaining tasks}

## Ready to Build (all dependencies met)
- {slug} Phase {id}: {name} — depends on: {list of completed dependencies}
- ...

## Blocked (dependencies not yet complete)
- {slug} Phase {id}: {name} — waiting on: {list of incomplete dependencies}
- ...
```

6. **Recommend** a single phase to build next. Prefer:
   - In-progress phases first (finish what's started)
   - Then the phase closest to the root of the dependency graph (unlocks the most downstream work)
   - Break ties by feature order: auth → campaigns → play-area → editor → characters

## Rules

- Feature doc statuses are the source of truth, not the roadmap table (they may drift)
- If the roadmap and feature doc disagree, flag the discrepancy
- Do not start building — only report and recommend
