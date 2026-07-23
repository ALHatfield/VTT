# Archived Phase 5A.1: Built-in Asset Seeds

- Feature: `editor`
- Source: `.project/features/editor.md`
- Archived: 2026-06-12

---

## Phase 5A.1: Built-in Asset Seeds

**Dependencies:** Phase 5A

### Tasks

- [x] Resolve URL serving strategy: decide between `client/public/` (Vite-served) or `server/uploads/` (Express-served) for built-in images
- [x] Add `/uploads` proxy rule to `vite.config.ts` (fixes existing gap for uploaded assets in dev)
- [x] Copy seed images from `image-seeds/` to chosen location (`client/public/tiles/`, `client/public/tokens/`)
- [x] Add `AssetSource` enum (`uploaded | builtin`) to Prisma schema
- [x] Make `TileAsset.campaignId` nullable, add `source` field with default `uploaded`
- [x] Run migration
- [x] Update `shared/src/types/editor.ts`: add `AssetSource` type, make `campaignId` nullable
- [x] Update `toTileAsset` mapper in `editor.service.ts` to handle nullable `campaignId` and `source`
- [x] Update `listTileAssets` to include built-in assets (OR query: campaign-specific + source=builtin)
- [x] Guard delete endpoint against built-in assets (reject with 403)
- [x] Hide delete button in `AssetLibrary` for `source === 'builtin'`
- [x] Extend seed script with deterministic IDs (`asset-seed-tile-001`, etc.) for built-in assets
- [x] Tests: list endpoint returns built-in + uploaded, delete rejects built-in, seed idempotency

### Decisions

- Use deterministic seed IDs (consistent with existing seed pattern) — no `@@unique` on `url` needed
- Built-in assets use `thumbnailUrl` pointing to the same file (seed images are already small)
- Token seed images are seeded as `playground` category tiles for now; token sprite icon integration is a separate concern for play-area
- See `.project/handoffs/editor-5B-builtin-assets.md` for full architecture plan and developer notes
- Built-in images served from `client/public/tiles/` and `client/public/tokens/` (Vite static in dev, dist output in prod)
- `getTileAsset` single-asset endpoint resolves built-ins via OR query (`campaignId` match OR `source = 'builtin'`)
- `deleteTileAsset` uses `findUnique` first to detect built-ins before campaign-scope check, returning 403 for built-ins

---


