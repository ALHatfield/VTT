-- CreateTable
CREATE TABLE "wall_segments" (
    "id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "x1" DOUBLE PRECISION NOT NULL,
    "y1" DOUBLE PRECISION NOT NULL,
    "x2" DOUBLE PRECISION NOT NULL,
    "y2" DOUBLE PRECISION NOT NULL,
    "blocks_light" BOOLEAN NOT NULL DEFAULT true,
    "blocks_movement" BOOLEAN NOT NULL DEFAULT true,
    "is_door" BOOLEAN NOT NULL DEFAULT false,
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wall_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wall_segments_campaign_id_scene_id_idx" ON "wall_segments"("campaign_id", "scene_id");

-- AddForeignKey
ALTER TABLE "wall_segments" ADD CONSTRAINT "wall_segments_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_segments" ADD CONSTRAINT "wall_segments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
