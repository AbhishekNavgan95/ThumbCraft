import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "@platform/errors";
import type Stripe from "stripe";
import {
  createCoinPackage,
  listActivePackages,
  listAllPackages,
  toPublicPackage,
  updateCoinPackage,
  type CreatePackageInput,
} from "../services/package.service.js";

export function validateCreatePackageInput(input: CreatePackageInput): void {
  if (!input.name || input.name.trim().length < 2) {
    throw new AppError("VALIDATION_ERROR", "Package name must be at least 2 characters", 422);
  }
  if (!Number.isInteger(input.coins) || input.coins <= 0) {
    throw new AppError("VALIDATION_ERROR", "Coins must be a positive integer", 422);
  }
  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
    throw new AppError("VALIDATION_ERROR", "priceCents must be a positive integer", 422);
  }
}

export async function listPackagesForCustomer(prisma: PrismaClient) {
  const packages = await listActivePackages(prisma);
  return { packages: packages.map(toPublicPackage) };
}

export async function listPackagesForAdmin(prisma: PrismaClient) {
  const packages = await listAllPackages(prisma);
  return { packages: packages.map(toPublicPackage) };
}

export async function createPackage(
  prisma: PrismaClient,
  stripe: Stripe,
  input: CreatePackageInput,
) {
  validateCreatePackageInput(input);
  const pkg = await createCoinPackage(prisma, stripe, input);
  return { package: toPublicPackage(pkg) };
}

export async function patchPackage(
  prisma: PrismaClient,
  packageId: string,
  input: { name?: string; active?: boolean },
) {
  if (input.name !== undefined && input.name.trim().length < 2) {
    throw new AppError("VALIDATION_ERROR", "Package name must be at least 2 characters", 422);
  }
  if (input.name === undefined && input.active === undefined) {
    throw new AppError("VALIDATION_ERROR", "Provide name and/or active to update", 422);
  }

  const pkg = await updateCoinPackage(prisma, packageId, input);
  return { package: toPublicPackage(pkg) };
}
