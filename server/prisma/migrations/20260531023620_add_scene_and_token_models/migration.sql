-- CreateEnum
CREATE TYPE "token_type" AS ENUM ('player', 'monster', 'npc', 'misc');

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "width" INTEGER NOT NULL DEFAULT 2048,
    "height" INTEGER NOT NULL DEFAULT 2048,
    "cell_size" INTEGER NOT NULL DEFAULT 64,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "name" TEXT NOT NULL,
    "type" "token_type" NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "size" INTEGER NOT NULL DEFAULT 1,
    "color" TEXT NOT NULL DEFAULT '#4a9eff',
    "icon_url" TEXT,
    "hp" INTEGER,
    "max_hp" INTEGER,
    "ac" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenes_campaign_id_idx" ON "scenes"("campaign_id");

-- CreateIndex
CREATE INDEX "tokens_scene_id_idx" ON "tokens"("scene_id");

-- CreateIndex
CREATE INDEX "tokens_campaign_id_idx" ON "tokens"("campaign_id");

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
