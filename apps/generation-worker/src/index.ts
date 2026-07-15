import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { createLogger } from "@platform/logger";
import { AppError } from "@platform/errors";
import { RabbitMQClient } from "@platform/rabbitmq-client";
import { loadGenerationConfig } from "./config.js";
import { createPrismaClient } from "./db/index.js";
import { WalletClient } from "./lib/wallet-client.js";
import { registerEnhanceRoutes } from "./modules/enhance/enhance.routes.js";
import { EnhanceService } from "./modules/enhance/enhance.service.js";
import { registerGalleryRoutes } from "./modules/gallery/gallery.routes.js";
import { registerModelRoutes } from "./modules/models/model.routes.js";
import { registerSessionRoutes } from "./modules/sessions/session.routes.js";
import { registerUploadRoutes } from "./modules/uploads/upload.routes.js";
import { UploadService } from "./modules/uploads/upload.service.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { createOpenAIClient } from "./providers/openai/openai.client.js";
import { PromptEnhancer } from "./providers/openai/prompt-enhancer.js";
import { createS3StorageFromEnv } from "./storage/index.js";
import "./types.js";

const config = loadGenerationConfig();
const logger = createLogger({
  service: config.SERVICE_NAME,
  level: config.LOG_LEVEL,
});

const app = Fastify({ logger: false, bodyLimit: 12 * 1024 * 1024 });
const prisma = createPrismaClient();
const rabbitmq = new RabbitMQClient({ url: config.RABBITMQ_URL });
const wallet = new WalletClient(config.WALLET_SERVICE_URL);

await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

app.addHook("onRequest", async (request) => {
  const incoming = request.headers["x-correlation-id"];
  request.correlationId =
    typeof incoming === "string" && incoming.length > 0
      ? incoming
      : randomUUID();
});

registerErrorHandler(app, logger);
await registerAuthPlugin(app);

app.get("/health", async () => ({
  status: "ok",
  service: config.SERVICE_NAME,
}));
app.get("/ready", async () => ({
  status: "ready",
  service: config.SERVICE_NAME,
  s3Configured: Boolean(config.AWS_S3_BUCKET),
  openaiConfigured: Boolean(config.OPENAI_API_KEY),
}));

await registerModelRoutes(app, prisma);
await registerGalleryRoutes(app, prisma);
await registerSessionRoutes(app, prisma);

if (config.OPENAI_API_KEY) {
  const openai = createOpenAIClient(config.OPENAI_API_KEY);
  const enhancer = new PromptEnhancer(openai, config.OPENAI_ENHANCE_MODEL);
  const enhanceService = new EnhanceService({
    prisma,
    rabbitmq,
    wallet,
    enhancer,
    logger,
  });
  await registerEnhanceRoutes(app, enhanceService);
} else {
  logger.warn("OPENAI_API_KEY not set — enhance-prompt routes will return 503");
  app.post(
    "/api/enhance-prompt",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async () => {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "Prompt enhancement is unavailable: OPENAI_API_KEY is not configured",
        503,
      );
    },
  );
}

if (!config.AWS_S3_BUCKET) {
  logger.warn("AWS_S3_BUCKET not set — upload routes will return 503");
}

const storage = config.AWS_S3_BUCKET ? createS3StorageFromEnv(config) : null;
const uploadService = storage ? new UploadService(storage) : null;

if (uploadService) {
  await registerUploadRoutes(app, uploadService);
} else {
  const unavailable = async () => {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "Image uploads are unavailable: AWS_S3_BUCKET is not configured",
      503,
    );
  };
  app.post("/internal/uploads/reference", unavailable);
  app.post(
    "/internal/uploads/template",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    unavailable,
  );
}

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
