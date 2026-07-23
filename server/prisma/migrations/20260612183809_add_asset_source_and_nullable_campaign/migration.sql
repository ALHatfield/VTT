-- CreateEnum
CREATE TYPE "asset_source" AS ENUM ('uploaded', 'builtin');

-- AlterTable
ALTER TABLE "tile_assets" ADD COLUMN     "source" "asset_source" NOT NULL DEFAULT 'uploaded',
ALTER COLUMN "campaign_id" DROP NOT NULL;
