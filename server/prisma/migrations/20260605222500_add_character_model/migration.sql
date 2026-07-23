-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "race" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "ability_scores" JSONB NOT NULL,
    "hp" INTEGER NOT NULL,
    "max_hp" INTEGER NOT NULL,
    "ac" INTEGER NOT NULL DEFAULT 10,
    "proficiency_bonus" INTEGER NOT NULL DEFAULT 2,
    "speed" INTEGER NOT NULL DEFAULT 30,
    "portrait_url" TEXT,
    "biography" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "characters_campaign_id_idx" ON "characters"("campaign_id");

-- CreateIndex
CREATE INDEX "characters_user_id_idx" ON "characters"("user_id");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
