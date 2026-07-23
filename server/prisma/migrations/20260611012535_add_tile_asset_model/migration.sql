-- CreateEnum
CREATE TYPE "asset_category" AS ENUM ('background', 'playground', 'foreground');

-- CreateTable
CREATE TABLE "tile_assets" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "category" "asset_category" NOT NULL DEFAULT 'background',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tile_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tile_assets_campaign_id_idx" ON "tile_assets"("campaign_id");

-- AddForeignKey
ALTER TABLE "tile_assets" ADD CONSTRAINT "tile_assets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
