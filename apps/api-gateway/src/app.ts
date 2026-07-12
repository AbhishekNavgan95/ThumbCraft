import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import type { Logger } from "@platform/logger";
import type { GatewayConfig } from "./config.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerGenerationRoutes } from "./routes/generations.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerHistoryRoutes } from "./routes/history.js";
import { registerWalletRoutes } from "./routes/wallet.js";
import "./types.js";

export async function createApp(config: GatewayConfig, logger: Logger) {
  const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  });

  app.addHook("onRequest", async (request) => {
    const incoming = request.headers["x-correlation-id"];
    request.correlationId =
      typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
  });

  registerErrorHandler(app, logger);
  await registerAuthPlugin(app, config);
  await registerHealthRoutes(app, config);
  await registerAuthRoutes(app, config);
  await registerWalletRoutes(app, config);
  await registerGenerationRoutes(app, config);
  await registerHistoryRoutes(app, config);

  return app;
}
