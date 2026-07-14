import type { FastifyInstance } from "fastify";
import type { UploadService } from "./upload.service.js";
import { uploadReferenceController } from "./upload.controller.js";

/**
 * Internal upload API — called only by API Gateway after JWT auth.
 * Public client path: POST /api/uploads/reference (gateway)
 * Worker path:        POST /internal/uploads/reference
 */
export async function registerUploadRoutes(
  app: FastifyInstance,
  uploadService: UploadService,
): Promise<void> {
  app.post("/internal/uploads/reference", async (request, reply) => {
    const body = await uploadReferenceController(request, uploadService);
    return reply.status(201).send(body);
  });
}
