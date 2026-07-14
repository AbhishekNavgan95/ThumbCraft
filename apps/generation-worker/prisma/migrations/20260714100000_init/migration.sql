-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('gemini', 'openai');

-- CreateEnum
CREATE TYPE "GenerationJobKind" AS ENUM ('generation', 'prompt_enhance');

-- CreateEnum
CREATE TYPE "GenerationJobStatus" AS ENUM ('created', 'reserved', 'processing', 'captured', 'released', 'failed');

-- CreateTable
CREATE TABLE "generation_models" (
    "id" UUID NOT NULL,
    "provider" "Provider" NOT NULL,
    "provider_model_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "supported_aspect_ratios" TEXT[] NOT NULL,
    "supported_resolutions" TEXT[] NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "generation_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "category" TEXT,
    "latest_interaction_id" TEXT,
    "latest_message_id" UUID,
    "latest_assistant_message_id" UUID,
    "status" "SessionStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "generation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "model_id" UUID NOT NULL,
    "original_prompt" TEXT,
    "enhanced_prompt" TEXT,
    "used_enhanced_prompt" BOOLEAN NOT NULL DEFAULT false,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "reference_image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reference_template_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required_aspect_ratio" TEXT,
    "required_resolution" TEXT,
    "reference_id" UUID,
    "image_url" TEXT,
    "mime_type" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "interaction_id" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "message_id" UUID,
    "kind" "GenerationJobKind" NOT NULL,
    "status" "GenerationJobStatus" NOT NULL DEFAULT 'created',
    "coin_cost" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "template_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thumbnail_templates" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "preview_url" TEXT,
    "aspect_ratio" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "thumbnail_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generation_models_provider_model_id_key" ON "generation_models"("provider_model_id");

-- CreateIndex
CREATE INDEX "idx_generation_models_visible_sort" ON "generation_models"("visible", "sort_order");

-- CreateIndex
CREATE INDEX "idx_generation_models_provider" ON "generation_models"("provider");

-- CreateIndex
CREATE INDEX "idx_generation_sessions_user_id" ON "generation_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_generation_sessions_user_status" ON "generation_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_generation_messages_session_id" ON "generation_messages"("session_id");

-- CreateIndex
CREATE INDEX "idx_generation_messages_session_created" ON "generation_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_generation_messages_session_role" ON "generation_messages"("session_id", "role");

-- CreateIndex
CREATE INDEX "idx_generation_messages_model_id" ON "generation_messages"("model_id");

-- CreateIndex
CREATE INDEX "idx_generation_messages_reference_id" ON "generation_messages"("reference_id");

-- CreateIndex
CREATE INDEX "idx_generation_messages_status" ON "generation_messages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "generation_jobs_idempotency_key_key" ON "generation_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_generation_jobs_user_id" ON "generation_jobs"("user_id");

-- CreateIndex
CREATE INDEX "idx_generation_jobs_session_id" ON "generation_jobs"("session_id");

-- CreateIndex
CREATE INDEX "idx_generation_jobs_message_id" ON "generation_jobs"("message_id");

-- CreateIndex
CREATE INDEX "idx_generation_jobs_kind_status" ON "generation_jobs"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "template_categories_slug_key" ON "template_categories"("slug");

-- CreateIndex
CREATE INDEX "idx_template_categories_active_sort" ON "template_categories"("active", "sort_order");

-- CreateIndex
CREATE INDEX "idx_thumbnail_templates_category_active_sort" ON "thumbnail_templates"("category_id", "active", "sort_order");

-- CreateIndex
CREATE INDEX "idx_thumbnail_templates_active" ON "thumbnail_templates"("active");

-- AddForeignKey
ALTER TABLE "generation_messages" ADD CONSTRAINT "generation_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "generation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_messages" ADD CONSTRAINT "generation_messages_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "generation_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_messages" ADD CONSTRAINT "generation_messages_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "generation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "generation_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "generation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thumbnail_templates" ADD CONSTRAINT "thumbnail_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "template_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
