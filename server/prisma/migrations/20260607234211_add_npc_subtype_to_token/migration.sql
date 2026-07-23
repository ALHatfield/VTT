-- CreateEnum
CREATE TYPE "npc_subtype" AS ENUM ('ally', 'enemy');

-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "npc_subtype" "npc_subtype";
