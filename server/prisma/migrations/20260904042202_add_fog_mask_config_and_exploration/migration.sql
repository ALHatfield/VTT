-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "fog_config" JSONB;

-- CreateTable
CREATE TABLE "fog_exploration" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "cell_key" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "radius" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fog_exploration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fog_exploration_campaign_id_scene_id_idx" ON "fog_exploration"("campaign_id", "scene_id");

-- CreateIndex
CREATE UNIQUE INDEX "fog_exploration_scene_id_cell_key_key" ON "fog_exploration"("scene_id", "cell_key");

-- AddForeignKey
ALTER TABLE "fog_exploration" ADD CONSTRAINT "fog_exploration_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fog_exploration" ADD CONSTRAINT "fog_exploration_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
