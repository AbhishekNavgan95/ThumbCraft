-- Add turn sequencing
ALTER TABLE "generation_sessions" ADD COLUMN "turn_seq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "generation_jobs" ADD COLUMN "turn_seq" INTEGER;
ALTER TABLE "generation_messages" ADD COLUMN "turn_seq" INTEGER;

-- Clean up duplicates if any exist (safe pre-check as per brief)
-- Enforce one active job per session for generation kind
CREATE UNIQUE INDEX "uniq_generation_jobs_active_session"
  ON "generation_jobs" ("session_id")
  WHERE "kind" = 'generation'
    AND "status" IN ('created', 'reserved', 'processing');
