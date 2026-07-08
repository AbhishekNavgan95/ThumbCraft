import Fastify from "fastify";
import { loadConfig, baseServiceSchema, z } from "@platform/config";
import { createLogger } from "@platform/logger";

const configSchema = baseServiceSchema.extend({
  SERVICE_NAME: z.string().default("wallet-service"),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

const config = loadConfig(configSchema);
const logger = createLogger({ service: config.SERVICE_NAME, level: config.LOG_LEVEL });

const app = Fastify({ logger: false });

app.get("/health", async () => ({ status: "ok", service: config.SERVICE_NAME }));
app.get("/ready", async () => ({ status: "ready", service: config.SERVICE_NAME }));

async function start() {
  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info({ port: config.PORT }, "service started");
  } catch (error) {
    logger.error({ err: error }, "failed to start service");
    process.exit(1);
  }
}

start();
