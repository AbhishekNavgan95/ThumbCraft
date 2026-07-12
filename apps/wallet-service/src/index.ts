import Fastify from "fastify";
import { RabbitMQClient } from "@platform/rabbitmq-client";
import { createLogger } from "@platform/logger";
import { loadWalletConfig } from "./config.js";
import { startWalletEventsConsumer } from "./consumers/wallet-events.consumer.js";
import { createPrismaClient } from "./db/index.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerWalletRoutes } from "./routes/wallet.js";
import { registerStripeWebhookRoutes } from "./routes/webhook.js";
import { createStripeClient } from "./services/stripe.service.js";
import "./types.js";

const config = loadWalletConfig();
const logger = createLogger({ service: config.SERVICE_NAME, level: config.LOG_LEVEL });

const app = Fastify({ logger: false });
const prisma = createPrismaClient();
const rabbitmq = new RabbitMQClient({ url: config.RABBITMQ_URL });
const stripe = createStripeClient(config);

app.get("/health", async () => ({ status: "ok", service: config.SERVICE_NAME }));
app.get("/ready", async () => ({ status: "ready", service: config.SERVICE_NAME }));

registerErrorHandler(app, logger);
await registerAuthPlugin(app);
await registerStripeWebhookRoutes(app, { prisma, stripe, rabbitmq, config, logger });
await registerWalletRoutes(app, { prisma, stripe, config });

async function start() {
  try {
    await prisma.$connect();
    logger.info("database connected");
    await rabbitmq.connect();
    await startWalletEventsConsumer(
      rabbitmq,
      prisma,
      config.WELCOME_BONUS_COINS,
      logger,
    );

    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info({ port: config.PORT }, "service started");
  } catch (error) {
    logger.error({ err: error }, "failed to start service");
    process.exit(1);
  }
}

async function shutdown() {
  logger.info("shutting down");
  await app.close();
  await rabbitmq.close();
  await prisma.$disconnect();
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

start();
