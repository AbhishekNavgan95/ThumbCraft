import type { PrismaClient } from "../generated/prisma/client.js";
import { listUserPaymentTransactions } from "../services/transaction.service.js";

export async function listTransactions(
  prisma: PrismaClient,
  userId: string,
  query: { limit?: number; cursor?: string },
) {
  return listUserPaymentTransactions(prisma, userId, query);
}
