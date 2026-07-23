# Handoff — Built-in Tile & Token Assets

Plan for shipping default tile and token images that every campaign can use without uploading.

---

## Goal

Add a set of seed images (tiles and tokens) as **built-in assets** available to all campaigns. These live in `client/public/` for serving and are seeded into the database so the existing `TileAsset` model and asset library UI work without special-case logic.

---

## Seed Images

Source directory: `image-seeds/`

| File | Type |
|------|------|
| `tile1.png` | Tile (background/playground) |
| `tile2.png` | Tile (background/playground) |
| `token1.png` | Token |
| `token2.png` | Token |
| `token3.png` | Token |
| `token4.png` | Token |
| `token5.png` | Token |
| `token6.png` | Token |

---

## Architecture: Option A — `source` field on TileAsset

### Why this approach

- Phase 5D will persist `TilePlacement` records referencing `TileAsset.id`. If built-in assets aren't in the database, every placement referencing them needs special-case logic.
- A single query fetches both built-in and uploaded assets — the asset library component needs zero changes.
- Built-in and uploaded assets are identical from the placement layer's perspective.

### Schema changes

1. **Add `AssetSource` enum** to Prisma schema:
   ```prisma
   enum AssetSource {
     uploaded
     builtin
   }
   ```

2. **Modify `TileAsset` model**:
   ```prisma
   model TileAsset {
     id           String        @id @default(uuid())
     campaignId   String?       @map("campaign_id")   // nullable — null for built-in assets
     filename     String
     url          String
     thumbnailUrl String        @map("thumbnail_url")
     width        Int
     height       Int
     category     AssetCategory @default(background)
     source       AssetSource   @default(uploaded)     // new field
     createdAt    DateTime      @default(now()) @map("created_at")
     updatedAt    DateTime      @updatedAt @map("updated_at")

     campaign Campaign? @relation(fields: [campaignId], references: [id], onDelete: Cascade)

     @@index([campaignId])
     @@map("tile_assets")
   }
   ```

   Key changes:
   - `campaignId` becomes `String?` (nullable) — built-in assets belong to no campaign
   - `campaign` relation becomes `Campaign?` (optional)
   - New `source` field with `AssetSource` enum, defaults to `uploaded`

3. **Update shared type** (`shared/src/types/editor.ts`):
   ```ts
   export type AssetSource = 'uploaded' | 'builtin';

   export interface TileAsset {
     id: string;
     campaignId: string | null;  // null for built-in assets
     filename: string;
     url: string;
     thumbnailUrl: string;
     width: number;
     height: number;
     category: AssetCategory;
     source: AssetSource;
     createdAt: string;
     updatedAt: string;
   }
   ```

---

## File placement

Copy seed images into `client/public/`:

```
client/public/
  tiles/
    tile1.png
    tile2.png
  tokens/
    token1.png
    token2.png
    token3.png
    token4.png
    token5.png
    token6.png
```

These are served by Vite in dev and by the static build output in production at `/tiles/tile1.png`, `/tokens/token1.png`, etc.

---

## Database seed

Extend `server/prisma/seed.ts` to insert built-in assets after the existing user seed:

```ts
const builtinAssets = [
  { filename: 'tile1.png', url: '/tiles/tile1.png', thumbnailUrl: '/tiles/tile1.png', width: TBD, height: TBD, category: 'background' as const },
  { filename: 'tile2.png', url: '/tiles/tile2.png', thumbnailUrl: '/tiles/tile2.png', width: TBD, height: TBD, category: 'background' as const },
  { filename: 'token1.png', url: '/tokens/token1.png', thumbnailUrl: '/tokens/token1.png', width: TBD, height: TBD, category: 'playground' as const },
  // ... remaining tokens
];

for (const asset of builtinAssets) {
  await prisma.tileAsset.upsert({
    where: { url: asset.url },          // needs @@unique on url, or use findFirst + create
    update: {},
    create: { ...asset, source: 'builtin', campaignId: null },
  });
}
```

**Note:** Actual `width` and `height` values need to be measured from the seed images before seeding.

---

## API changes

The asset list endpoint (`GET /api/campaigns/:campaignId/assets`) must be updated to return **both** campaign-specific assets and built-in assets:

```ts
const assets = await prisma.tileAsset.findMany({
  where: {
    OR: [
      { campaignId: campaignId },
      { source: 'builtin' },
    ],
  },
  orderBy: { createdAt: 'asc' },
});
```

The delete endpoint should reject deletion of built-in assets (guard on `source !== 'builtin'`).

---

## Asset library UI

No changes needed — the `AssetLibrary` component already renders whatever `TileAsset[]` the hook returns. Built-in assets will appear alongside uploaded ones.

Optional enhancement: show a small badge or icon on built-in assets to distinguish them, and hide the delete button for `source === 'builtin'`.

---

## Implementation order

1. Copy seed images from `image-seeds/` → `client/public/tiles/` and `client/public/tokens/`
2. Add `AssetSource` enum and update `TileAsset` model in Prisma schema
3. Run migration (`npm run db:migrate`)
4. Update `shared/src/types/editor.ts` with `AssetSource` type and nullable `campaignId`
5. Update seed script to insert built-in assets
6. Update asset list API to include built-in assets in results
7. Guard delete endpoint against built-in assets
8. Run `npm run db:seed`
9. Verify built-in assets appear in asset library for any campaign

---

## Developer Notes — Issues & Structural Concerns

### 1. URL serving conflict — `client/public/` vs Express static

Uploaded assets are served by Express at `/uploads/assets/*` (via `app.use('/uploads', express.static('uploads'))` in [app.ts](server/src/app.ts)). The Vite proxy forwards `/api` and `/socket.io` to the server but does **not** proxy `/uploads`, meaning in dev, uploaded assets are unreachable from the client unless a `/uploads` proxy rule is added (or this is already handled by the browser hitting port 3001 directly — verify).

Built-in assets in `client/public/tiles/` and `client/public/tokens/` would be served by Vite's dev server at `/tiles/*` and `/tokens/*`. This means:
- **Dev**: Two different static servers handle two sets of assets (Vite for built-in, Express for uploaded).
- **Production**: The built output puts `public/` files in `dist/`, but Express serves `uploads/`. The production server needs to serve both the Vite build output AND the uploads directory.

**Decision needed:** Either:
- (a) Put built-in images in `server/uploads/assets/` alongside uploaded assets so everything is served by Express under `/uploads/assets/*`. Simpler URL handling, but blurs the line between user content and app content.
- (b) Keep `client/public/` and add a `/uploads` proxy rule to `vite.config.ts` for dev. For production, ensure the Express server also serves the built client `dist/` directory (or use a reverse proxy like nginx).
- (c) Keep `client/public/` for built-in assets, but store their URLs in the DB as `/tiles/tile1.png` etc. This works if the production deployment serves the Vite build output at the root — needs to be verified.

### 2. Vite proxy for `/uploads` is missing

The Vite dev proxy only forwards `/api` and `/socket.io`. Uploaded assets referenced as `/uploads/assets/...` in the database won't load in the client during dev unless a proxy rule is added:

```ts
'/uploads': {
  target: 'http://localhost:3001',
  changeOrigin: true,
},
```

This is needed regardless of the built-in asset decision — it's an existing gap for uploaded assets too.

### 3. `upsert` on `url` requires a `@@unique` constraint

The handoff's seed snippet uses `prisma.tileAsset.upsert({ where: { url: asset.url } })`, but `url` has no `@@unique` constraint on the model. Prisma will reject this at compile time. Options:
- Add `@unique` to the `url` field (reasonable — no two assets should share a URL).
- Use a `findFirst` + conditional `create` pattern instead (avoids schema change but loses atomicity).
- Use deterministic seed IDs (like the existing seed patterns: `'asset-seed-tile-001'`) and upsert on `id`.

**Recommendation:** Use deterministic IDs matching the existing seed convention — this is consistent with how users, campaigns, scenes, tokens, and characters are seeded. Avoids adding a `@@unique` constraint that may not be needed beyond seeding.

### 4. `toTileAsset` mapper must handle nullable `campaignId` and new `source` field

The current `toTileAsset` function in [editor.service.ts](server/src/features/editor/editor.service.ts) hard-types `campaignId` as `string` (not `string | null`) and doesn't map a `source` field. After the migration, this function must:
- Accept `campaignId: string | null`
- Map the new `source` field to the output
- Update the row type signature to include `source: string`

### 5. `listTileAssets` service function signature

The current function signature is `listTileAssets(campaignId: string, category?)` and queries `where: { campaignId }`. To include built-in assets, the query must use `OR: [{ campaignId }, { source: 'builtin' }]`. But the function is also used in `deleteTileAsset` — make sure the delete path still scopes to `campaignId` and doesn't accidentally match built-in assets.

Actually, `deleteTileAsset` uses its own query (`findFirst where: { id, campaignId }`). Since built-in assets have `campaignId: null`, a delete scoped to a specific campaign ID will naturally not match them. This is safe — but add an explicit guard and return a `403`-style error for clarity.

### 6. `AssetLibrary` delete button should be hidden for built-in assets

The component currently shows a delete button for all assets when `isDm` is true. After this change, it should check `asset.source !== 'builtin'` before rendering the delete button. Otherwise the DM can click delete, get a 404/403, and be confused.

### 7. Token images vs. tile images — different use cases

The seed images include both **tiles** (map backgrounds/overlays) and **tokens** (character/creature icons). These serve different purposes:
- Tiles go through the `TileAsset` model and the editor's asset library.
- Token icons are set via the `Token.iconUrl` field and displayed by `TokenSprite.ts`.

Currently `TokenSprite` renders colored circles with text labels — it doesn't load `iconUrl` images. If the token images are meant to be used as token icons (not tile overlays), they should **not** be seeded as `TileAsset` records. They'd need a separate mechanism (e.g., a token icon library or just referencing the public URL directly in `Token.iconUrl`).

**Decision needed:** Are the `token*.png` files meant for:
- (a) The editor asset library (draggable tile overlays on the playground layer)?
- (b) Token sprite icons (replacing the colored circle in `TokenSprite`)?
- (c) Both?

### 8. Image dimensions must be measured before seeding

The seed data needs actual `width` and `height` values. The developer will need to either:
- Manually inspect each image and hardcode dimensions, or
- Read dimensions at seed time using Jimp (already a dependency), e.g.:

```ts
import { Jimp } from 'jimp';
const img = await Jimp.read('path/to/image-seeds/tile1.png');
const { width, height } = img.bitmap;
```

The seed script runs in Node.js, so this is viable. But the images need to be accessible from `server/prisma/seed.ts` at runtime — they must exist at a known path relative to the server package (not just in `client/public/`).

### 9. `AssetCategory` for token images

Tokens don't map cleanly to the existing `AssetCategory` enum (`background | playground | foreground`). If token images go into `TileAsset`, `playground` is the closest fit, but it's semantically muddy. If tokens are a distinct concern, consider whether a new category value (e.g., `token`) is warranted, or whether to keep them separate entirely.

---

## Open Questions

- Should built-in token images also integrate with the token placement system (play-area), or are they editor-only for now?
- Should `thumbnailUrl` for built-in assets point to the same file (since they're already small), or should we generate separate thumbnails?
- Final category assignments for each seed image (background vs. playground vs. foreground) need to be decided based on the actual image content.
- Which URL strategy for built-in assets: `client/public/` (Vite-served) or `server/uploads/` (Express-served)?
