import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { Logger } from "@platform/logger";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import {
  RoutingKeys,
  type PlatformEvent,
  type WalletPurchaseCompletedPayload,
  type WalletPurchaseFailedPayload,
} from "@platform/messaging-contract";
import type Stripe from "stripe";
import { creditPurchase } from "../services/wallet.service.js";

export async function handleStripeWebhook(
  prisma: PrismaClient,
  stripe: Stripe,
  rabbitmq: RabbitMQClient,
  logger: Logger,
  webhookSecret: string,
  rawBody: Buffer,
  signature: string,
): Promise<{ received: true }> {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    logger.warn({ err: error }, "stripe webhook signature verification failed");
    throw Object.assign(new Error(message), { statusCode: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        prisma,
        rabbitmq,
        logger,
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    case "checkout.session.expired":
      await handleCheckoutFailed(
        prisma,
        rabbitmq,
        logger,
        event.data.object as Stripe.Checkout.Session,
        "expired",
        "Checkout session expired before payment was completed",
      );
      break;
    case "checkout.session.async_payment_failed":
      await handleCheckoutFailed(
        prisma,
        rabbitmq,
        logger,
        event.data.object as Stripe.Checkout.Session,
        "failed",
        "Async payment failed",
      );
      break;
    default:
      logger.debug({ type: event.type }, "ignored stripe event");
  }

  return { received: true };
}

function readCheckoutIdentity(session: Stripe.Checkout.Session): {
  userId: string;
  email: string;
  name: string;
  packageId: string;
  packageName: string;
  coins: number;
} | null {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  const email = session.metadata?.email ?? session.customer_details?.email ?? undefined;
  const name = session.metadata?.name ?? session.customer_details?.name ?? undefined;
  const packageId = session.metadata?.packageId;
  const packageName = session.metadata?.packageName ?? "Coin package";
  const coins = Number(session.metadata?.coins ?? 0);

  if (
    !userId ||
    !email ||
    !name ||
    !packageId ||
    !Number.isFinite(coins) ||
    coins <= 0
  ) {
    return null;
  }

  return { userId, email, name, packageId, packageName, coins };
}

async function markCheckoutCompleted(
  prisma: PrismaClient,
  sessionId: string,
  stripePaymentId: string,
): Promise<void> {
  await prisma.checkoutSession.updateMany({
    where: {
      stripeSessionId: sessionId,
      status: { not: "completed" },
    },
    data: {
      status: "completed",
      stripePaymentId,
      failureReason: null,
    },
  });
}

async function handleCheckoutCompleted(
  prisma: PrismaClient,
  rabbitmq: RabbitMQClient,
  logger: Logger,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const identity = readCheckoutIdentity(session);
  if (!identity) {
    logger.error(
      { sessionId: session.id, metadata: session.metadata },
      "checkout session missing required metadata",
    );
    return;
  }

  const stripePaymentId = session.payment_intent
    ? String(session.payment_intent)
    : session.id;

  const { credited } = await creditPurchase(prisma, {
    userId: identity.userId,
    coins: identity.coins,
    packageId: identity.packageId,
    stripePaymentId,
  });

  await markCheckoutCompleted(prisma, session.id, stripePaymentId);

  if (!credited) {
    logger.info(
      { stripePaymentId, userId: identity.userId },
      "purchase already credited (idempotent)",
    );
    return;
  }

  const event: PlatformEvent<WalletPurchaseCompletedPayload> = {
    eventId: randomUUID(),
    correlationId: session.id,
    timestamp: new Date().toISOString(),
    userId: identity.userId,
    payload: {
      email: identity.email,
      name: identity.name,
      coins: identity.coins,
      packageName: identity.packageName,
      stripePaymentId,
    },
  };

  await rabbitmq.publish(RoutingKeys.WALLET_PURCHASE_COMPLETED, event);
  logger.info(
    { userId: identity.userId, coins: identity.coins, stripePaymentId },
    "purchase credited",
  );
}

async function handleCheckoutFailed(
  prisma: PrismaClient,
  rabbitmq: RabbitMQClient,
  logger: Logger,
  session: Stripe.Checkout.Session,
  status: "failed" | "expired",
  reason: string,
): Promise<void> {
  const identity = readCheckoutIdentity(session);
  if (!identity) {
    logger.error(
      { sessionId: session.id, metadata: session.metadata, reason },
      "checkout failure missing required metadata",
    );
    return;
  }

  const updated = await prisma.checkoutSession.updateMany({
    where: {
      stripeSessionId: session.id,
      status: "pending",
    },
    data: {
      status,
      failureReason: reason,
    },
  });

  if (updated.count === 0) {
    logger.info(
      { sessionId: session.id, status },
      "checkout failure ignored (not pending)",
    );
    return;
  }

  const event: PlatformEvent<WalletPurchaseFailedPayload> = {
    eventId: randomUUID(),
    correlationId: session.id,
    timestamp: new Date().toISOString(),
    userId: identity.userId,
    payload: {
      email: identity.email,
      name: identity.name,
      coins: identity.coins,
      packageName: identity.packageName,
      reason,
    },
  };

  await rabbitmq.publish(RoutingKeys.WALLET_PURCHASE_FAILED, event);
  logger.info(
    { userId: identity.userId, sessionId: session.id, reason },
    "purchase failure event published",
  );
}
