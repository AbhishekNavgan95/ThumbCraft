import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { createLogger } from "@platform/logger";
import { AppError } from "@platform/errors";
import { loadGenerationConfig } from "./config.js";
import { createPrismaClient } from "./db/index.js";
import { registerModelRoutes } from "./modules/models/model.routes.js";
import { registerUploadRoutes } from "./modules/uploads/upload.routes.js";
import { UploadService } from "./modules/uploads/upload.service.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { createS3StorageFromEnv } from "./storage/index.js";
import "./types.js";

const config = loadGenerationConfig();
const logger = createLogger({
  service: config.SERVICE_NAME,
  level: config.LOG_LEVEL,
});

const app = Fastify({ logger: false, bodyLimit: 12 * 1024 * 1024 });
const prisma = createPrismaClient();

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
}));

await registerModelRoutes(app, prisma);

if (!config.AWS_S3_BUCKET) {
  logger.warn("AWS_S3_BUCKET not set — upload routes will return 503");
}

const storage = config.AWS_S3_BUCKET ? createS3StorageFromEnv(config) : null;
const uploadService = storage ? new UploadService(storage) : null;

if (uploadService) {
  await registerUploadRoutes(app, uploadService);
} else {
  app.post("/internal/uploads/reference", async () => {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "Image uploads are unavailable: AWS_S3_BUCKET is not configured",
      503,
    );
  });
}

async function start() {
  try {
    await prisma.$connect();
    logger.info("database connected");
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
  await prisma.$disconnect();
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

start();
