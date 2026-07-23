-- CreateTable
CREATE TABLE "fog_regions" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "vertices" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fog_regions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fog_regions_campaign_id_scene_id_idx" ON "fog_regions"("campaign_id", "scene_id");

-- AddForeignKey
ALTER TABLE "fog_regions" ADD CONSTRAINT "fog_regions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fog_regions" ADD CONSTRAINT "fog_regions_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fog_regions" ADD CONSTRAINT "fog_regions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
