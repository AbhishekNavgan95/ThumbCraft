import Fastify from "fastify";
import { createLogger } from "@platform/logger";
import { RabbitMQClient } from "@platform/rabbitmq-client";
import { startOtpRequestedConsumer } from "./consumers/otp-requested.consumer.js";
import { loadNotificationConfig } from "./config.js";

const config = loadNotificationConfig();
const logger = createLogger({ service: config.SERVICE_NAME, level: config.LOG_LEVEL });

const app = Fastify({ logger: false });
const rabbitmq = new RabbitMQClient({ url: config.RABBITMQ_URL });

app.get("/health", async () => ({ status: "ok", service: config.SERVICE_NAME }));
app.get("/ready", async () => ({ status: "ready", service: config.SERVICE_NAME }));

async function start() {
  try {
    await rabbitmq.connect();
    await startOtpRequestedConsumer(rabbitmq, logger);

    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info({ port: config.PORT, smtpHost: config.SMTP_HOST }, "service started");
  } catch (error) {
    logger.error({ err: error }, "failed to start service");
    process.exit(1);
  }
}

async function shutdown() {
  logger.info("shutting down");
  await app.close();
  await rabbitmq.close();
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

start();
