import { createLogger } from "@platform/logger";
import { createApp } from "./app.js";
import { loadGatewayConfig } from "./config.js";

const config = loadGatewayConfig();
const logger = createLogger({ service: config.SERVICE_NAME, level: config.LOG_LEVEL });

async function start() {
  try {
    const app = await createApp(config, logger);
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info({ port: config.PORT }, "api gateway started");
  } catch (error) {
    logger.error({ err: error }, "failed to start api gateway");
    process.exit(1);
  }
}

start();
