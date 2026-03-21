-- TroubleShotPost는 20260408000000 에서 생성됐으나 ballPlacementJson 미포함.
-- 20260320120000 의 ADD COLUMN 은 그보다 먼저 실행되어 테이블 없으면 적용되지 않은 DB가 있음.
ALTER TABLE "TroubleShotPost" ADD COLUMN IF NOT EXISTS "ballPlacementJson" TEXT;
