import { RabbitMQClient } from "@platform/rabbitmq-client";
import { createLogger } from "@platform/logger";
import { createApp } from "./app.js";
import { loadWalletConfig } from "./config.js";
import { startWalletEventsConsumer } from "./consumers/wallet-events.consumer.js";
import { createPrismaClient } from "./db/index.js";
import { createStripeClient } from "./services/stripe.service.js";

const config = loadWalletConfig();
const logger = createLogger({
  service: config.SERVICE_NAME,
  level: config.LOG_LEVEL,
});

const prisma = createPrismaClient();
const rabbitmq = new RabbitMQClient({ url: config.RABBITMQ_URL });
const stripe = createStripeClient(config);
const app = await createApp({ config, logger, prisma, stripe, rabbitmq });

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
