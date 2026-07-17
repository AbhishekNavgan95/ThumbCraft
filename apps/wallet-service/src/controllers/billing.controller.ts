import { AppError } from "@platform/errors";
import type { PrismaClient } from "../generated/prisma/client.js";
import {
  captureCoins,
  quoteCoins,
  releaseCoins,
  reserveCoins,
  type QuoteKind,
} from "../services/wallet.service.js";

const QUOTE_KINDS = new Set<QuoteKind>(["prompt_enhance", "generation"]);

export function quoteBilling(
  body: Record<string, unknown>,
  costs: { promptEnhance: number; generation: number },
) {
  const kind = body.kind;
  if (typeof kind !== "string" || !QUOTE_KINDS.has(kind as QuoteKind)) {
    throw new AppError(
      "VALIDATION_ERROR",
      'kind must be "prompt_enhance" or "generation"',
      422,
    );
  }

  return quoteCoins(kind as QuoteKind, costs);
}

export async function reserveBilling(
  prisma: PrismaClient,
  userId: string,
  body: Record<string, unknown>,
) {
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const amount = body.amount;

  if (!jobId) {
    throw new AppError("VALIDATION_ERROR", "jobId is required", 422);
  }
  if (typeof amount !== "number") {
    throw new AppError("VALIDATION_ERROR", "amount must be a number", 422);
  }

  const result = await reserveCoins(prisma, { userId, jobId, amount });
  return {
    jobId: result.jobId,
    amount: result.amount,
    balanceCoins: result.balanceCoins,
    reservedCoins: result.reservedCoins,
    idempotent: result.idempotent,
  };
}

export async function captureBilling(
  prisma: PrismaClient,
  userId: string,
  jobId: string,
) {
  return captureCoins(prisma, { userId, jobId });
}

export async function releaseBilling(
  prisma: PrismaClient,
  userId: string,
  jobId: string,
) {
  return releaseCoins(prisma, { userId, jobId });
}
