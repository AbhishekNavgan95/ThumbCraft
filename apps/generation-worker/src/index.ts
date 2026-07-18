import { createLogger } from "@platform/logger";
import { RabbitMQClient } from "@platform/rabbitmq-client";
import type { Worker } from "bullmq";
import { createApp } from "./app.js";
import { loadGenerationConfig } from "./config.js";
import { createPrismaClient } from "./db/index.js";
import { WalletClient } from "./lib/wallet-client.js";
import { EnhanceService } from "./modules/enhance/enhance.service.js";
import { GenerateService } from "./modules/generate/generate.service.js";
import { UploadService } from "./modules/uploads/upload.service.js";
import {
  createGenerationQueue,
  createRedisConnection,
  startGenerationWorker,
  type GenerationJobPayload,
} from "./queue/index.js";
import { createS3StorageFromEnv } from "./storage/index.js";

const config = loadGenerationConfig();
const logger = createLogger({
  service: config.SERVICE_NAME,
  level: config.LOG_LEVEL,
});

const prisma = createPrismaClient();
const rabbitmq = new RabbitMQClient({ url: config.RABBITMQ_URL });
const wallet = new WalletClient(config.WALLET_SERVICE_URL);

const redis = createRedisConnection(config.REDIS_URL);
const generationQueue = createGenerationQueue(redis);

let enhanceService: EnhanceService | null = null;
if (config.OPENAI_API_KEY?.trim()) {
  enhanceService = new EnhanceService({
    prisma,
    rabbitmq,
    wallet,
    logger,
    openaiApiKey: config.OPENAI_API_KEY,
    enhanceModel: config.OPENAI_ENHANCE_MODEL,
  });
} else {
  logger.warn("OPENAI_API_KEY not set — enhance-prompt returns 503");
}

let uploadService: UploadService | null = null;
let storage: ReturnType<typeof createS3StorageFromEnv> | null = null;
if (config.AWS_S3_BUCKET) {
  storage = createS3StorageFromEnv(config);
  uploadService = new UploadService(config);
} else {
  logger.warn(
    "AWS_S3_BUCKET not set — uploads / generated image persistence unavailable",
  );
}

const generateService = new GenerateService({
  prisma,
  rabbitmq,
  wallet,
  logger,
  geminiApiKey: config.GEMINI_API_KEY,
  openaiApiKey: config.OPENAI_API_KEY,
  storage,
  fakeImageGeneration: config.FAKE_IMAGE_GENERATION,
  generationQueue,
});

if (config.FAKE_IMAGE_GENERATION) {
  logger.warn("FAKE_IMAGE_GENERATION=true — real image LLM calls are disabled");
}

const app = await createApp({
  config,
  logger,
  prisma,
  enhanceService,
  uploadService,
  generateService,
});

let generationWorker: Worker<GenerationJobPayload> | null = null;

async function start() {
  try {
    await prisma.$connect();
    logger.info("database connected");
    await rabbitmq.connect();
    logger.info("rabbitmq connected");

    // Separate Redis connection for the Worker (BullMQ recommendation).
    const workerRedis = createRedisConnection(config.REDIS_URL);
    generationWorker = startGenerationWorker({
      connection: workerRedis,
      generateService,
      logger,
    });
    logger.info("bullmq generation worker started");

    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info({ port: config.PORT }, "service started");
  } catch (error) {
    logger.error({ err: error }, "failed to start service");
    process.exit(1);
  }
}

async function shutdown() {
  logger.info("shutting down");
  if (generationWorker) {
    await generationWorker.close();
  }
  await generationQueue.close();
  await redis.quit();
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
