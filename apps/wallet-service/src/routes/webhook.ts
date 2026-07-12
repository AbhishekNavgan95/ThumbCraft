import { AppError } from "@platform/errors";
import type { Logger } from "@platform/logger";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../generated/prisma/client.js";
import type Stripe from "stripe";
import type { WalletServiceConfig } from "../config.js";
import { handleStripeWebhook } from "../services/webhook.service.js";

/**
 * Stripe requires the raw request body for signature verification.
 * Registered in an isolated scope with a buffer JSON parser.
 */
export async function registerStripeWebhookRoutes(
  app: FastifyInstance,
  deps: {
    prisma: PrismaClient;
    stripe: Stripe;
    rabbitmq: RabbitMQClient;
    config: WalletServiceConfig;
    logger: Logger;
  },
): Promise<void> {
  const { prisma, stripe, rabbitmq, config, logger } = deps;

  await app.register(async (webhookApp) => {
    webhookApp.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_request, body, done) => {
        done(null, body);
      },
    );

    webhookApp.post("/webhooks/stripe", async (request, reply) => {
      const signature = request.headers["stripe-signature"];
      if (typeof signature !== "string" || signature.length === 0) {
        throw new AppError("VALIDATION_ERROR", "Missing Stripe-Signature header", 400);
      }

      const rawBody = Buffer.isBuffer(request.body)
        ? request.body
        : Buffer.from(String(request.body ?? ""));

      try {
        const result = await handleStripeWebhook(
          prisma,
          stripe,
          rabbitmq,
          logger,
          config.STRIPE_WEBHOOK_SECRET,
          rawBody,
          signature,
        );
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof Error && "statusCode" in error) {
          throw new AppError("VALIDATION_ERROR", error.message, 400);
        }
        throw error;
      }
    });
  });
}
