import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { Logger } from "@platform/logger";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import {
  RoutingKeys,
  type PlatformEvent,
  type WalletPurchaseCompletedPayload,
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleCheckoutCompleted(prisma, rabbitmq, logger, session);
  } else {
    logger.debug({ type: event.type }, "ignored stripe event");
  }

  return { received: true };
}

async function handleCheckoutCompleted(
  prisma: PrismaClient,
  rabbitmq: RabbitMQClient,
  logger: Logger,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  const packageId = session.metadata?.packageId;
  const coins = Number(session.metadata?.coins ?? 0);
  const stripePaymentId = session.payment_intent
    ? String(session.payment_intent)
    : session.id;

  if (!userId || !packageId || !Number.isFinite(coins) || coins <= 0) {
    logger.error(
      { sessionId: session.id, metadata: session.metadata },
      "checkout session missing required metadata",
    );
    return;
  }

  const { credited } = await creditPurchase(prisma, {
    userId,
    coins,
    packageId,
    stripePaymentId,
  });

  if (!credited) {
    logger.info({ stripePaymentId, userId }, "purchase already credited (idempotent)");
    return;
  }

  const event: PlatformEvent<WalletPurchaseCompletedPayload> = {
    eventId: randomUUID(),
    correlationId: session.id,
    timestamp: new Date().toISOString(),
    userId,
    payload: {
      coins,
      stripePaymentId,
    },
  };

  await rabbitmq.publish(RoutingKeys.WALLET_PURCHASE_COMPLETED, event);
  logger.info({ userId, coins, stripePaymentId }, "purchase credited");
}
