import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "@platform/errors";
import type Stripe from "stripe";
import type { WalletServiceConfig } from "../config.js";
import { createCheckoutSession } from "../services/checkout.service.js";

export interface CheckoutInput {
  packageId: string;
}

export function validateCheckoutInput(input: CheckoutInput): void {
  if (!input.packageId || input.packageId.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "packageId is required", 422);
  }
}

export async function startCheckout(
  prisma: PrismaClient,
  stripe: Stripe,
  config: WalletServiceConfig,
  user: { id: string; email: string; name: string },
  input: CheckoutInput,
) {
  validateCheckoutInput(input);
  return createCheckoutSession(prisma, stripe, config, user, input.packageId.trim());
}
