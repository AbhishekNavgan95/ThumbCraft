-- AlterTable
ALTER TABLE "generation_sessions" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "idx_generation_sessions_user_pinned" ON "generation_sessions"("user_id", "pinned");

-- AlterTable
ALTER TABLE "generation_messages" ADD COLUMN "provider_input" TEXT;
