-- CreateTable
CREATE TABLE "character_tokens" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "character_tokens_character_id_key" ON "character_tokens"("character_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_tokens_token_id_key" ON "character_tokens"("token_id");

-- CreateIndex
CREATE INDEX "character_tokens_campaign_id_idx" ON "character_tokens"("campaign_id");

-- AddForeignKey
ALTER TABLE "character_tokens" ADD CONSTRAINT "character_tokens_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_tokens" ADD CONSTRAINT "character_tokens_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_tokens" ADD CONSTRAINT "character_tokens_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
