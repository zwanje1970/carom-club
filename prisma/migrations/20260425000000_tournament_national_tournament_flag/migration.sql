-- 등치 인덱스로 전국대회 필터 (ILIKE '%전국%' 제거)
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "nationalTournament" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Tournament"
SET "nationalTournament" = true
WHERE region = '전국'
   OR region ILIKE '%전국%';

CREATE INDEX IF NOT EXISTS "Tournament_nationalTournament_idx" ON "Tournament" ("nationalTournament");

-- confirmed 카운트 서브쿼리/조인용 (CONFIRMED만)
CREATE INDEX IF NOT EXISTS "TournamentEntry_tournamentId_confirmed_idx"
  ON "TournamentEntry" ("tournamentId")
  WHERE status = 'CONFIRMED';
