import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "@platform/errors";
import type Stripe from "stripe";
import type { WalletServiceConfig } from "../config.js";
import { findPackageById } from "../services/package.service.js";
import { getOrCreateWallet } from "../services/wallet.service.js";

export async function getOrCreateStripeCustomer(
  prisma: PrismaClient,
  stripe: Stripe,
  user: { id: string; email: string; name: string },
): Promise<string> {
  const existing = await prisma.stripeCustomer.findUnique({
    where: { userId: user.id },
  });
  if (existing) {
    return existing.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });

  await prisma.stripeCustomer.create({
    data: {
      userId: user.id,
      stripeCustomerId: customer.id,
    },
  });

  return customer.id;
}

export async function createCheckoutSession(
  prisma: PrismaClient,
  stripe: Stripe,
  config: WalletServiceConfig,
  user: { id: string; email: string; name: string },
  packageId: string,
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const coinPackage = await findPackageById(prisma, packageId);
  if (!coinPackage || !coinPackage.active) {
    throw new AppError("NOT_FOUND", "Coin package not found or inactive", 404);
  }

  await getOrCreateWallet(prisma, user.id);
  const customerId = await getOrCreateStripeCustomer(prisma, stripe, user);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: coinPackage.stripePriceId, quantity: 1 }],
    success_url: config.STRIPE_SUCCESS_URL,
    cancel_url: config.STRIPE_CANCEL_URL,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      email: user.email,
      name: user.name,
      packageId: coinPackage.id,
      packageName: coinPackage.name,
      coins: String(coinPackage.coins),
    },
  });

  if (!session.url) {
    throw new AppError("INTERNAL_ERROR", "Failed to create Stripe checkout session", 500);
  }

  await prisma.checkoutSession.create({
    data: {
      stripeSessionId: session.id,
      userId: user.id,
      packageId: coinPackage.id,
      packageName: coinPackage.name,
      coins: coinPackage.coins,
      status: "pending",
    },
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}

export async function getCheckoutPaymentStatus(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
) {
  const checkout = await prisma.checkoutSession.findUnique({
    where: { stripeSessionId: sessionId },
  });

  if (!checkout || checkout.userId !== userId) {
    throw new AppError("NOT_FOUND", "Payment session not found", 404);
  }

  return {
    payment: {
      sessionId: checkout.stripeSessionId,
      status: checkout.status,
      coins: checkout.coins,
      packageId: checkout.packageId,
      packageName: checkout.packageName,
      stripePaymentId: checkout.stripePaymentId,
      failureReason: checkout.failureReason,
      updatedAt: checkout.updatedAt.toISOString(),
    },
  };
}
