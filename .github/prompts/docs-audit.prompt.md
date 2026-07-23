---
description: "Run a full documentation audit — check structural sync, cross-document consistency, and implementation accuracy across the project. Reports drift and offers to fix it."
mode: docs-keeper
---
Run a full three-pass documentation audit for the VTT project.

## What This Does

Scans the filesystem, `package.json` files, and all project documentation to find inconsistencies. Reports findings in a structured format, then asks which fixes to apply.

## Scanning

Use a single terminal command to capture the full directory structure instead of walking directories one by one:
```bash
find . -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/coverage/*' -not -path '*/package-lock.json' | sort
```

## Passes

1. **Structural Sync** — verify `.project/project-tree.md`, `copilot-instructions.md` structure, feature registry paths, tech stack deps, and build scripts all match the filesystem
2. **Cross-Document Sync** — verify roadmap ↔ feature doc statuses, phase completion records, development note slugs, and copilot ↔ roadmap feature lists agree
3. **Implementation Sync** — verify feature doc task checklists accurately reflect what's implemented in the codebase

## Rules

- Present the full report before making any changes
- Ask which fixes to apply (all, by pass, or individually)
- Follow source-of-truth rules — update derived documents, not the source
