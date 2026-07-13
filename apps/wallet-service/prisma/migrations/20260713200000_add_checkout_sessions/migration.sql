-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('pending', 'completed', 'failed', 'expired');

-- CreateTable
CREATE TABLE "checkout_sessions" (
    "id" UUID NOT NULL,
    "stripe_session_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "package_name" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'pending',
    "stripe_payment_id" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkout_sessions_stripe_session_id_key" ON "checkout_sessions"("stripe_session_id");

-- CreateIndex
CREATE INDEX "idx_checkout_sessions_user_id" ON "checkout_sessions"("user_id");
