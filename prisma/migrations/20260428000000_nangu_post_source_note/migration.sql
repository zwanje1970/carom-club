-- Optional link from 난구노트 to 난구해결사(NanguPost) for 재사용·연결 UI
ALTER TABLE "NanguPost" ADD COLUMN IF NOT EXISTS "sourceNoteId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "NanguPost_sourceNoteId_key" ON "NanguPost"("sourceNoteId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NanguPost_sourceNoteId_fkey'
  ) THEN
    ALTER TABLE "NanguPost"
      ADD CONSTRAINT "NanguPost_sourceNoteId_fkey"
      FOREIGN KEY ("sourceNoteId") REFERENCES "BilliardNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
