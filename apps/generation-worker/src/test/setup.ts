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
    process.env.GENERATION_TEST_DATABASE_URL ??
    "postgresql://thumbcraft:thumbcraft@localhost:5432/generation_test";
  prisma = createPrismaClient();
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "generation_outbox",
      "generation_jobs",
      "generation_messages",
      "generation_sessions",
      "thumbnail_templates",
      "template_categories",
      "generation_models"
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await prisma?.$disconnect();
});
