import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
