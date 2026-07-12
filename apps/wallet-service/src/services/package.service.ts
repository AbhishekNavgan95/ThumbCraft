import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "@platform/errors";
import type Stripe from "stripe";

export interface CreatePackageInput {
  name: string;
  coins: number;
  priceCents: number;
  currency?: string;
}

export async function listActivePackages(prisma: PrismaClient) {
  return prisma.coinPackage.findMany({
    where: { active: true },
    orderBy: { priceCents: "asc" },
  });
}

export async function listAllPackages(prisma: PrismaClient) {
  return prisma.coinPackage.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function findPackageById(prisma: PrismaClient, packageId: string) {
  return prisma.coinPackage.findUnique({ where: { id: packageId } });
}

export async function createCoinPackage(
  prisma: PrismaClient,
  stripe: Stripe,
  input: CreatePackageInput,
) {
  const currency = (input.currency ?? "usd").toLowerCase();
  const name = input.name.trim();

  const product = await stripe.products.create({
    name,
    metadata: {
      coins: String(input.coins),
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: input.priceCents,
    currency,
    metadata: {
      coins: String(input.coins),
    },
  });

  return prisma.coinPackage.create({
    data: {
      name,
      coins: input.coins,
      priceCents: input.priceCents,
      currency,
      stripeProductId: product.id,
      stripePriceId: price.id,
      active: true,
    },
  });
}

export async function updateCoinPackage(
  prisma: PrismaClient,
  packageId: string,
  input: { name?: string; active?: boolean },
) {
  const existing = await findPackageById(prisma, packageId);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Coin package not found", 404);
  }

  return prisma.coinPackage.update({
    where: { id: packageId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
}

export function toPublicPackage(pkg: {
  id: string;
  name: string;
  coins: number;
  priceCents: number;
  currency: string;
  active: boolean;
}) {
  return {
    id: pkg.id,
    name: pkg.name,
    coins: pkg.coins,
    priceCents: pkg.priceCents,
    currency: pkg.currency,
    active: pkg.active,
  };
}
