-- CreateEnum
CREATE TYPE "light_emitter_type" AS ENUM ('torch', 'fireplace', 'lantern', 'beacon', 'custom');

-- CreateEnum
CREATE TYPE "light_animation_mode" AS ENUM ('none', 'flicker', 'pulse');

-- CreateEnum
CREATE TYPE "weather_preset" AS ENUM ('none', 'rain', 'snow', 'haze');

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "weather_preset" "weather_preset" NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "light_sources" (
    "id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "radius" DOUBLE PRECISION NOT NULL,
    "color" TEXT NOT NULL,
    "intensity" DOUBLE PRECISION NOT NULL,
    "falloff" DOUBLE PRECISION NOT NULL,
    "emitter_type" "light_emitter_type" NOT NULL,
    "animation_mode" "light_animation_mode" NOT NULL DEFAULT 'none',
    "animation_seed" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "light_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "light_sources_campaign_id_scene_id_idx" ON "light_sources"("campaign_id", "scene_id");

-- AddForeignKey
ALTER TABLE "light_sources" ADD CONSTRAINT "light_sources_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "light_sources" ADD CONSTRAINT "light_sources_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
