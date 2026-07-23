# Feature: editor — Phase 5A.1: Built-in Asset Seeds

**Completed:** June 12, 2026
**Feature:** `editor`

## Deliverables

**client/**

- `client/public/tiles/tile1.png` — built-in background tile (753×571)
- `client/public/tiles/tile2.png` — built-in background tile (898×722)
- `client/public/tokens/token1.png` … `token6.png` — built-in playground tokens (180–205px)
- `client/vite.config.ts` — added `/uploads` proxy rule (fixes dev gap for uploaded assets)
- `client/src/features/editor/components/AssetLibrary.tsx` — hide delete button for `source === 'builtin'`

**shared/**

- `shared/src/types/editor.ts` — added `AssetSource` type; `TileAsset.campaignId` now `string | null`; added `source: AssetSource` field

**server/**

- `server/prisma/schema.prisma` — added `AssetSource` enum; `TileAsset.campaignId` nullable; added `source` field (default `uploaded`)
- `server/prisma/migrations/20260612183809_add_asset_source_and_nullable_campaign/` — migration
- `server/prisma/seed.ts` — 8 built-in asset upserts with deterministic IDs (`asset-seed-tile-001` … `asset-seed-token-006`)
- `server/src/features/editor/editor.service.ts` — updated mapper, `listTileAssets` OR-queries built-ins, `getTileAsset` resolves built-ins, `deleteTileAsset` guards built-ins
- `server/src/features/editor/editor.routes.ts` — DELETE handler returns 403 for built-in assets
- `server/src/features/editor/editor.routes.test.ts` — added Phase 5A.1 describe block (7 new tests); fixed stale assertions

## Test Results

```
npx vitest run
Test Files  30 passed (30)
     Tests  372 passed (372)
  Duration  ~61s
```

New Phase 5A.1 tests (all passing):

- list endpoint includes built-in assets alongside uploaded ones
- list endpoint with category filter includes matching built-in assets
- list endpoint with category filter excludes built-in assets of other categories
- delete endpoint rejects deletion of built-in assets with 403
- built-in asset seed is idempotent — re-running upsert does not duplicate
- asset list response includes source field on each asset
- GET single asset endpoint resolves built-in by ID

Verified via curl: `GET /api/campaigns/campaign-seed-001/assets` returns 8 built-in assets with `campaignId: null` and `source: "builtin"`.

## Decisions & Insights

- **Built-in images in `client/public/`** — served by Vite in dev at `/tiles/*` and `/tokens/*`; no Express route needed. Added `/uploads` proxy to Vite for uploaded assets (existing gap fixed as a prerequisite).
- **Deterministic seed IDs** — consistent with all prior seed patterns (users, campaigns, scenes, tokens, characters). No `@@unique` on `url` needed.
- **`getTileAsset` OR query** — built-in assets have `campaignId: null`; using `findUnique({ id }) + OR([campaignId, source=builtin])` pattern means single-asset GETs work for both uploaded and built-in assets without special-casing in the route layer.
- **`deleteTileAsset` findUnique first** — we fetch by ID alone (not `campaignId`) so we can distinguish "not found" (404) from "found but builtin" (403) from "found but belongs to different campaign" (404). The campaign-scope check comes after the builtin guard.
- **Thumbnail = source image for built-ins** — seed images are already small (≤200px tokens, tiles fit in the library panel). Full-size thumbnails are acceptable for now; Phase 5B can add pre-scaled versions if needed.

## Dependencies Unlocked

- **editor Phase 5B** (Scene Editor Canvas & Persistence) — built-in assets are now in the database as `TileAsset` rows, so the `TilePlacement` model can reference them by ID without special-casing.
