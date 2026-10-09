-- CreateEnum
CREATE TYPE "game_system" AS ENUM ('dnd5e', 'pf2e');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "game_system" "game_system" NOT NULL DEFAULT 'dnd5e';
