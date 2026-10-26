import Fastify from "fastify";
import type { Logger } from "@platform/logger";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import type Stripe from "stripe";
import type { WalletServiceConfig } from "./config.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerWalletRoutes } from "./routes/wallet.js";
import { registerStripeWebhookRoutes } from "./routes/webhook.js";
import "./types.js";

/**
 * HTTP app only — no listen, no RabbitMQ consumer.
 * Tests and `index.ts` compose this; side-effectful startup stays outside.
 */
export async function createApp(deps: {
  config: WalletServiceConfig;
  logger: Logger;
  prisma: PrismaClient;
  stripe: Stripe;
  /** When omitted, Stripe webhook routes are not registered (unit tests). */
  rabbitmq?: RabbitMQClient | null;
}) {
  const { config, logger, prisma, stripe, rabbitmq } = deps;
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({
    status: "ok",
    service: config.SERVICE_NAME,
  }));
  app.get("/ready", async () => ({
    status: "ready",
    service: config.SERVICE_NAME,
  }));

  registerErrorHandler(app, logger);
  await registerAuthPlugin(app);

  if (rabbitmq) {
    await registerStripeWebhookRoutes(app, {
      prisma,
      stripe,
      rabbitmq,
      config,
      logger,
    });
  }

  await registerWalletRoutes(app, { prisma, stripe, config });

  return app;
}
