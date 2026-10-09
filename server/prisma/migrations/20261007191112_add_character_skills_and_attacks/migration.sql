-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "attacks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "skill_proficiencies" JSONB NOT NULL DEFAULT '[]';
