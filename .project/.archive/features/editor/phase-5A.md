# Archived Phase 5A: Editor Mode & Asset Library

- Feature: `editor`
- Source: `.project/features/editor.md`
- Archived: 2026-06-11

---

## Phase 5A: Editor Mode & Asset Library

**Dependencies:** campaigns Phase 3A, play-area Phase 4A

### Tasks
- [x] `EditorModeContext` — shared `'play' | 'editor'` mode state with provider at play-area root
- [x] "Editor" button in campaign toolbar (DM-only, guarded by `useCampaignRole` hook)
- [x] "Back to Play Area" button in campaign toolbar (visible only in editor mode)
- [x] UI swap logic — conditionally render play-mode panels vs editor-mode panels based on mode state (renders whatever play-mode panels exist; components from later phases like CanvasToolbar from 4F.3 automatically participate when built)
- [x] Prisma `TileAsset` model (filename, url, dimensions, campaignId)
- [x] Asset upload routes (accept PNG, JPEG, WebP) — DM-only, campaign-scoped
- [x] Asset library UI — browsable gallery with thumbnails, rendered in editor mode
- [x] Asset categorization: background, playground, foreground
- [x] Drag handle on asset thumbnails for canvas drop
- [x] Shared types: `EditorMode`, `TileAsset`, `AssetCategory`, `AssetUploadPayload`
- [x] Tests: mode toggle state, role guard, upload validation (file type, size limits), CRUD, campaign scoping

### Decisions
- Editor is a **mode toggle** inside the play-area, not a separate route — see `.project/notes/editor-5A-editor-mode-integration.md`
- The PixiJS canvas stays mounted across mode switches; only surrounding UI and interaction handlers change
- Components exclusive to editor mode live in `features/editor/components/`; mode toggle logic lives in `features/play-area/` (it owns the layout)
- Assets are campaign-scoped — each campaign has its own library
- File storage: local filesystem for MVP, S3/cloud for production
- Thumbnail generation on upload
- **DM-only access:** Editor button and routes require `dm` role (see `.project/notes/rbac-architecture.md`)

---


