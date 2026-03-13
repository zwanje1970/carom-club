-- Add Tournament.title (optional display title; name remains required)
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "title" TEXT;
