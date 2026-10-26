import { afterAll, beforeAll, beforeEach } from "vitest";
import { createPrismaClient } from "../db/index.js";
import type { PrismaClient } from "../generated/prisma/client.js";

let prisma: PrismaClient;

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error("Test Prisma client not initialized");
  }
  return prisma;
}

beforeAll(async () => {
  process.env.DATABASE_URL ??=
    process.env.WALLET_TEST_DATABASE_URL ??
    "postgresql://thumbcraft:thumbcraft@localhost:5432/wallet_test";
  prisma = createPrismaClient();
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "transactions",
      "checkout_sessions",
      "wallets",
      "coin_packages",
      "stripe_customers"
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await prisma?.$disconnect();
});
