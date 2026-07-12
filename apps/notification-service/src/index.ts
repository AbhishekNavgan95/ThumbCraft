import Fastify from "fastify";
import { createLogger } from "@platform/logger";
import { RabbitMQClient } from "@platform/rabbitmq-client";
import { startNotificationEventsConsumer } from "./consumers/notification-events.consumer.js";
import { loadNotificationConfig } from "./config.js";
import { MailService } from "./services/mail.service.js";

const config = loadNotificationConfig();
const logger = createLogger({ service: config.SERVICE_NAME, level: config.LOG_LEVEL });

const app = Fastify({ logger: false });
const rabbitmq = new RabbitMQClient({ url: config.RABBITMQ_URL });
const mail = new MailService(config, logger);

app.get("/health", async () => ({ status: "ok", service: config.SERVICE_NAME }));
app.get("/ready", async () => ({ status: "ready", service: config.SERVICE_NAME }));

async function start() {
  try {
    await rabbitmq.connect();
    await mail.verify();
    await startNotificationEventsConsumer(rabbitmq, mail, logger);

    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info({ port: config.PORT, mailHost: config.MAIL_HOST }, "service started");
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
