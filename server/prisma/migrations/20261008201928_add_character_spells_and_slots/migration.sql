-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "spell_slots" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "spells" JSONB NOT NULL DEFAULT '[]';
