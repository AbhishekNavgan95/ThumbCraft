import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import type { Logger } from "@platform/logger";
import type { GenerationWorkerConfig } from "./config.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { registerEnhanceRoutes } from "./modules/enhance/enhance.routes.js";
import type { EnhanceService } from "./modules/enhance/enhance.service.js";
import { registerGalleryRoutes } from "./modules/gallery/gallery.routes.js";
import { registerHealthRoutes } from "./modules/health/health.routes.js";
import { registerModelRoutes } from "./modules/models/model.routes.js";
import { registerSessionRoutes } from "./modules/sessions/session.routes.js";
import { registerUploadRoutes } from "./modules/uploads/upload.routes.js";
import type { UploadService } from "./modules/uploads/upload.service.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import "./types.js";

export async function createApp(deps: {
  config: GenerationWorkerConfig;
  logger: Logger;
  prisma: PrismaClient;
  enhanceService: EnhanceService;
  uploadService: UploadService;
}) {
  const { config, logger, prisma, enhanceService, uploadService } = deps;
  const app = Fastify({ logger: false, bodyLimit: 12 * 1024 * 1024 });

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

  await registerHealthRoutes(app, config);
  await registerModelRoutes(app, prisma);
  await registerGalleryRoutes(app, prisma);
  await registerSessionRoutes(app, prisma);
  await registerEnhanceRoutes(app, enhanceService);
  await registerUploadRoutes(app, uploadService);

  return app;
}
