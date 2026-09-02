ALTER TABLE "tokens" ADD COLUMN "aura_radius" INTEGER;
ALTER TABLE "tokens" ADD COLUMN "aura_color" TEXT;
ALTER TABLE "tokens" ADD COLUMN "aura_visible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tokens" ADD COLUMN "aura_type" TEXT;
ALTER TABLE "tokens" ADD COLUMN "aura_condition" TEXT;