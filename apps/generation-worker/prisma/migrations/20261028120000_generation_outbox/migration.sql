-- CreateTable
CREATE TABLE "generation_outbox" (
    "id" UUID NOT NULL,
    "job_id" UUID,
    "routing_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generation_outbox_job_id_key" ON "generation_outbox"("job_id");

-- CreateIndex
CREATE INDEX "idx_generation_outbox_pending" ON "generation_outbox"("published_at", "created_at");

-- AddForeignKey
ALTER TABLE "generation_outbox" ADD CONSTRAINT "generation_outbox_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
