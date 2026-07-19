import type { PrismaClient } from "../generated/prisma/client.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function listUserPaymentTransactions(
  prisma: PrismaClient,
  userId: string,
  options: { limit?: number; cursor?: string } = {},
) {
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  const sessions = await prisma.checkoutSession.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(options.cursor
      ? {
          cursor: { id: options.cursor },
          skip: 1,
        }
      : {}),
  });

  const hasMore = sessions.length > limit;
  const page = hasMore ? sessions.slice(0, limit) : sessions;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

  return {
    transactions: page.map((session) => ({
      id: session.id,
      sessionId: session.stripeSessionId,
      packageId: session.packageId,
      packageName: session.packageName,
      coins: session.coins,
      status: session.status,
      stripePaymentId: session.stripePaymentId,
      failureReason: session.failureReason,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    })),
    nextCursor,
  };
}
