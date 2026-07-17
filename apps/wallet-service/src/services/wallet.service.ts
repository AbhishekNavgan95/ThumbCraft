import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "@platform/errors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type QuoteKind = "prompt_enhance" | "generation";

export async function getOrCreateWallet(prisma: PrismaClient, userId: string) {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  return prisma.wallet.create({
    data: { userId },
  });
}

export async function getWallet(prisma: PrismaClient, userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    throw new AppError("NOT_FOUND", "Wallet not found", 404);
  }
  return wallet;
}

export function quoteCoins(
  kind: QuoteKind,
  costs: { promptEnhance: number; generation: number },
): { kind: QuoteKind; coinCost: number } {
  if (kind === "prompt_enhance") {
    return { kind, coinCost: costs.promptEnhance };
  }
  if (kind === "generation") {
    return { kind, coinCost: costs.generation };
  }
  throw new AppError("VALIDATION_ERROR", `Unsupported quote kind: ${kind}`, 422);
}

function assertJobId(jobId: string): string {
  const trimmed = jobId.trim();
  if (!UUID_RE.test(trimmed)) {
    throw new AppError("VALIDATION_ERROR", "jobId must be a valid UUID", 422);
  }
  return trimmed;
}

/**
 * Hold coins for a job. Moves balance → reserved.
 * Idempotent on `reserve:{jobId}`.
 */
export async function reserveCoins(
  prisma: PrismaClient,
  input: { userId: string; jobId: string; amount: number },
) {
  const jobId = assertJobId(input.jobId);
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new AppError("VALIDATION_ERROR", "amount must be a positive integer", 422);
  }

  const idempotencyKey = `reserve:${jobId}`;
  const existing = await prisma.transaction.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (existing.userId !== input.userId) {
      throw new AppError("FORBIDDEN", "Job reserve belongs to another user", 403);
    }
    const wallet = await getOrCreateWallet(prisma, input.userId);
    return {
      jobId,
      amount: existing.amount,
      balanceCoins: wallet.balanceCoins,
      reservedCoins: wallet.reservedCoins,
      idempotent: true,
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId, balanceCoins: 0, reservedCoins: 0 },
        update: {},
      });

      if (wallet.balanceCoins < input.amount) {
        throw new AppError(
          "INSUFFICIENT_FUNDS",
          "Insufficient coin balance",
          402,
          {
            balanceCoins: wallet.balanceCoins,
            required: input.amount,
          },
        );
      }

      const updated = await tx.wallet.update({
        where: { userId: input.userId },
        data: {
          balanceCoins: { decrement: input.amount },
          reservedCoins: { increment: input.amount },
        },
      });

      await tx.transaction.create({
        data: {
          userId: input.userId,
          type: "reserve",
          amount: input.amount,
          status: "completed",
          jobId,
          idempotencyKey,
        },
      });

      return updated;
    });

    return {
      jobId,
      amount: input.amount,
      balanceCoins: result.balanceCoins,
      reservedCoins: result.reservedCoins,
      idempotent: false,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const again = await prisma.transaction.findUnique({
      where: { idempotencyKey },
    });
    if (again && again.userId === input.userId) {
      const wallet = await getOrCreateWallet(prisma, input.userId);
      return {
        jobId,
        amount: again.amount,
        balanceCoins: wallet.balanceCoins,
        reservedCoins: wallet.reservedCoins,
        idempotent: true,
      };
    }
    throw error;
  }
}

/**
 * Finalize a reserve: drop reserved coins (spent).
 * Idempotent on `capture:{jobId}`.
 */
export async function captureCoins(
  prisma: PrismaClient,
  input: { userId: string; jobId: string },
) {
  const jobId = assertJobId(input.jobId);
  const captureKey = `capture:${jobId}`;
  const releaseKey = `release:${jobId}`;
  const reserveKey = `reserve:${jobId}`;

  const existingCapture = await prisma.transaction.findUnique({
    where: { idempotencyKey: captureKey },
  });
  if (existingCapture) {
    return { jobId, amount: existingCapture.amount, idempotent: true };
  }

  const existingRelease = await prisma.transaction.findUnique({
    where: { idempotencyKey: releaseKey },
  });
  if (existingRelease) {
    throw new AppError(
      "CONFLICT",
      "Cannot capture: coins were already released for this job",
      409,
    );
  }

  const reserve = await prisma.transaction.findUnique({
    where: { idempotencyKey: reserveKey },
  });
  if (!reserve) {
    throw new AppError("NOT_FOUND", "No reserve found for job", 404);
  }
  if (reserve.userId !== input.userId) {
    throw new AppError("FORBIDDEN", "Job reserve belongs to another user", 403);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: input.userId },
      });
      if (!wallet || wallet.reservedCoins < reserve.amount) {
        throw new AppError(
          "CONFLICT",
          "Reserved balance is insufficient to capture",
          409,
        );
      }

      await tx.wallet.update({
        where: { userId: input.userId },
        data: { reservedCoins: { decrement: reserve.amount } },
      });

      await tx.transaction.create({
        data: {
          userId: input.userId,
          type: "capture",
          amount: reserve.amount,
          status: "completed",
          jobId,
          idempotencyKey: captureKey,
        },
      });
    });

    return { jobId, amount: reserve.amount, idempotent: false };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const again = await prisma.transaction.findUnique({
      where: { idempotencyKey: captureKey },
    });
    if (again) {
      return { jobId, amount: again.amount, idempotent: true };
    }
    throw error;
  }
}

/**
 * Refund a reserve: reserved → balance.
 * Idempotent on `release:{jobId}`.
 */
export async function releaseCoins(
  prisma: PrismaClient,
  input: { userId: string; jobId: string },
) {
  const jobId = assertJobId(input.jobId);
  const captureKey = `capture:${jobId}`;
  const releaseKey = `release:${jobId}`;
  const reserveKey = `reserve:${jobId}`;

  const existingRelease = await prisma.transaction.findUnique({
    where: { idempotencyKey: releaseKey },
  });
  if (existingRelease) {
    return { jobId, amount: existingRelease.amount, idempotent: true };
  }

  const existingCapture = await prisma.transaction.findUnique({
    where: { idempotencyKey: captureKey },
  });
  if (existingCapture) {
    throw new AppError(
      "CONFLICT",
      "Cannot release: coins were already captured for this job",
      409,
    );
  }

  const reserve = await prisma.transaction.findUnique({
    where: { idempotencyKey: reserveKey },
  });
  if (!reserve) {
    // Nothing reserved — treat as no-op (safe for compensation race).
    return { jobId, amount: 0, idempotent: true };
  }
  if (reserve.userId !== input.userId) {
    throw new AppError("FORBIDDEN", "Job reserve belongs to another user", 403);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: input.userId },
      });
      if (!wallet || wallet.reservedCoins < reserve.amount) {
        throw new AppError(
          "CONFLICT",
          "Reserved balance is insufficient to release",
          409,
        );
      }

      await tx.wallet.update({
        where: { userId: input.userId },
        data: {
          balanceCoins: { increment: reserve.amount },
          reservedCoins: { decrement: reserve.amount },
        },
      });

      await tx.transaction.create({
        data: {
          userId: input.userId,
          type: "release",
          amount: reserve.amount,
          status: "completed",
          jobId,
          idempotencyKey: releaseKey,
        },
      });
    });

    return { jobId, amount: reserve.amount, idempotent: false };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const again = await prisma.transaction.findUnique({
      where: { idempotencyKey: releaseKey },
    });
    if (again) {
      return { jobId, amount: again.amount, idempotent: true };
    }
    throw error;
  }
}

export async function creditWelcomeBonus(
  prisma: PrismaClient,
  userId: string,
  coins: number,
): Promise<void> {
  const idempotencyKey = `welcome_bonus:${userId}`;
  const existing = await prisma.transaction.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.wallet.upsert({
      where: { userId },
      create: { userId, balanceCoins: coins },
      update: { balanceCoins: { increment: coins } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: "welcome_bonus",
        amount: coins,
        status: "completed",
        idempotencyKey,
      },
    });
  });
}

export async function creditPurchase(
  prisma: PrismaClient,
  input: {
    userId: string;
    coins: number;
    packageId: string;
    stripePaymentId: string;
  },
): Promise<{ credited: boolean }> {
  const existing = await prisma.transaction.findUnique({
    where: { stripePaymentId: input.stripePaymentId },
  });
  if (existing) {
    return { credited: false };
  }

  const idempotencyKey = `purchase:${input.stripePaymentId}`;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.wallet.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId, balanceCoins: input.coins },
        update: { balanceCoins: { increment: input.coins } },
      });

      await tx.transaction.create({
        data: {
          userId: input.userId,
          type: "purchase",
          amount: input.coins,
          status: "completed",
          packageId: input.packageId,
          stripePaymentId: input.stripePaymentId,
          idempotencyKey,
        },
      });
    });

    return { credited: true };
  } catch (error) {
    const again = await prisma.transaction.findUnique({
      where: { stripePaymentId: input.stripePaymentId },
    });
    if (again) {
      return { credited: false };
    }
    throw error;
  }
}
