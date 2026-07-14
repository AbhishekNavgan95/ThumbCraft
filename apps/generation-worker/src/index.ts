import Fastify from "fastify";
import { createLogger } from "@platform/logger";
import { loadGenerationConfig } from "./config.js";

const config = loadGenerationConfig();
const logger = createLogger({ service: config.SERVICE_NAME, level: config.LOG_LEVEL });

const app = Fastify({ logger: false });

app.get("/health", async () => ({ status: "ok", service: config.SERVICE_NAME }));
app.get("/ready", async () => ({
  status: "ready",
  service: config.SERVICE_NAME,
  s3Configured: Boolean(config.AWS_S3_BUCKET),
}));

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
