import type { PrismaClient } from "../generated/prisma/client.js";
import { getOrCreateWallet } from "../services/wallet.service.js";

export async function getWalletBalance(prisma: PrismaClient, userId: string) {
  const wallet = await getOrCreateWallet(prisma, userId);
  return {
    balanceCoins: wallet.balanceCoins,
    reservedCoins: wallet.reservedCoins,
  };
}
