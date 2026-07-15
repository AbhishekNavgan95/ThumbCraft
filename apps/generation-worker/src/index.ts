import { createLogger } from "@platform/logger";
import { RabbitMQClient } from "@platform/rabbitmq-client";
import { createApp } from "./app.js";
import { loadGenerationConfig } from "./config.js";
import { createPrismaClient } from "./db/index.js";
import { WalletClient } from "./lib/wallet-client.js";
import { EnhanceService } from "./modules/enhance/enhance.service.js";
import { UploadService } from "./modules/uploads/upload.service.js";

const config = loadGenerationConfig();
const logger = createLogger({
  service: config.SERVICE_NAME,
  level: config.LOG_LEVEL,
});

const prisma = createPrismaClient();
const rabbitmq = new RabbitMQClient({ url: config.RABBITMQ_URL });
const wallet = new WalletClient(config.WALLET_SERVICE_URL);
const enhanceService = new EnhanceService({
  prisma,
  rabbitmq,
  wallet,
  logger,
  openaiApiKey: config.OPENAI_API_KEY,
  enhanceModel: config.OPENAI_ENHANCE_MODEL,
});
const uploadService = new UploadService(config);

const app = await createApp({
  config,
  logger,
  prisma,
  enhanceService,
  uploadService,
});

async function start() {
  try {
    await prisma.$connect();
    logger.info("database connected");
    await rabbitmq.connect();
    logger.info("rabbitmq connected");
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
