import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "@platform/errors";

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
