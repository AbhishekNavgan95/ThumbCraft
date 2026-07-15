import type { FastifyInstance } from "fastify";
import type { GenerationWorkerConfig } from "../../config.js";

export async function registerHealthRoutes(
  app: FastifyInstance,
  config: GenerationWorkerConfig,
): Promise<void> {
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
}
