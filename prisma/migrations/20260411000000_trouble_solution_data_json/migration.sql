-- AlterTable: TroubleShotSolution solutionDataJson
ALTER TABLE "TroubleShotSolution" ADD COLUMN IF NOT EXISTS "solutionDataJson" TEXT;
