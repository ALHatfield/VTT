-- CreateTable
CREATE TABLE "tile_placements" (
    "id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "z_index" INTEGER NOT NULL DEFAULT 0,
    "category" "asset_category" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tile_placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tile_placements_scene_id_idx" ON "tile_placements"("scene_id");

-- CreateIndex
CREATE INDEX "tile_placements_campaign_id_idx" ON "tile_placements"("campaign_id");

-- AddForeignKey
ALTER TABLE "tile_placements" ADD CONSTRAINT "tile_placements_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tile_placements" ADD CONSTRAINT "tile_placements_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "tile_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tile_placements" ADD CONSTRAINT "tile_placements_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
