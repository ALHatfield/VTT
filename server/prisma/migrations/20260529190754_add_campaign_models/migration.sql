-- CreateEnum
CREATE TYPE "campaign_role" AS ENUM ('dm', 'player', 'observer');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_players" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "campaign_role" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_players_user_id_idx" ON "campaign_players"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_players_campaign_id_user_id_key" ON "campaign_players"("campaign_id", "user_id");

-- AddForeignKey
ALTER TABLE "campaign_players" ADD CONSTRAINT "campaign_players_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_players" ADD CONSTRAINT "campaign_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
