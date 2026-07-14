import type { FastifyInstance } from "fastify";
import type { UploadService } from "./upload.service.js";
import {
  uploadReferenceController,
  uploadTemplateController,
} from "./upload.controller.js";

/**
 * Internal upload API — called only by API Gateway after JWT auth.
 * Public client path: POST /api/uploads/reference (gateway)
 * Worker path:        POST /internal/uploads/reference
 *
 * Admin gallery upload:
 * Public:  POST /api/uploads/template (gateway, requireAdmin)
 * Worker:  POST /internal/uploads/template
 */
export async function registerUploadRoutes(
  app: FastifyInstance,
  uploadService: UploadService,
): Promise<void> {
  app.post("/internal/uploads/reference", async (request, reply) => {
    const body = await uploadReferenceController(request, uploadService);
    return reply.status(201).send(body);
  });

  app.post(
    "/internal/uploads/template",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const body = await uploadTemplateController(request, uploadService);
      return reply.status(201).send(body);
    },
  );
}
