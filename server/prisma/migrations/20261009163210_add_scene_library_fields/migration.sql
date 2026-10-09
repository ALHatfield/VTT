-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "thumbnail_url" TEXT;

-- Backfill sort_order from creation order within each campaign
UPDATE "scenes" s
SET "sort_order" = sub.rn - 1
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "campaign_id" ORDER BY "created_at", "id") AS rn
  FROM "scenes"
) sub
WHERE s."id" = sub."id";

-- Deactivate all but the earliest-created active scene per campaign so the
-- partial unique index below can be created on existing data
UPDATE "scenes" s
SET "is_active" = false
WHERE s."is_active"
  AND s."id" NOT IN (
    SELECT DISTINCT ON ("campaign_id") "id"
    FROM "scenes"
    WHERE "is_active"
    ORDER BY "campaign_id", "created_at", "id"
  );

-- Enforce a single active scene per campaign
CREATE UNIQUE INDEX "scenes_one_active_per_campaign" ON "scenes" ("campaign_id") WHERE "is_active";
