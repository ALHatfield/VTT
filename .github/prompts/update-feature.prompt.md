---
description: "Lightweight status sync — scan the codebase and update a feature doc's task checkboxes and phase statuses. Does NOT create phase records, update the roadmap, or update the project tree. For full post-phase documentation, use the developer agent's Documentation Phase instead."
agent: agent
argument-hint: "Feature slug (auth, campaigns, play-area, editor, characters)"
---
Sync a feature document's task list against the actual codebase. This is a quick check — not a full documentation update.

> **Note:** This prompt only updates `.project/features/{slug}.md`. It does NOT update `.project/roadmap.md`, create phase completion records, or update `.project/project-tree.md`. For the full documentation lifecycle, use the `developer` agent's Documentation Phase.

## Steps

1. **Read the feature doc** at `.project/features/{slug}.md`
2. **Read the matching instruction file** at `.github/instructions/feature-{slug}.instructions.md` to understand the feature scope
3. **Scan the codebase** for implemented work — run a single terminal command to list all relevant files:
   ```bash
   find ./client/src/features/{slug} ./server/src/features/{slug} ./shared/src -not -path '*/node_modules/*' 2>/dev/null | sort
   ```
   Also check:
   - `server/prisma/schema.prisma` for relevant models (if applicable)
   - Test files co-located with source files
4. **Update the task list**: Check off (`- [x]`) any tasks where the corresponding implementation exists in the codebase
5. **Update the status table**: Change phase status to `In Progress` if some tasks are checked, `Complete` if all tasks in that phase are done
6. **Log new decisions**: If any implementation choices were made that aren't already captured in the Decisions section, add them
7. **Do NOT** remove or reword existing tasks, decisions, or architectural notes — only add checkmarks and status updates

## Rules

- Only check off a task if the implementation actually exists — never mark tasks complete speculatively
- If a task is partially done, leave it unchecked and add a note in parentheses: `- [ ] Task name (partial: routes done, tests pending)`
- Keep the document structure intact — don't reorder sections or reformat
- When updating status to `Complete`, verify ALL tasks in that phase are checked
