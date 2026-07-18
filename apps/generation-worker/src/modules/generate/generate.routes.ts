import type { FastifyInstance } from "fastify";
import { generateController } from "./generate.controller.js";
import type { GenerateService } from "./generate.service.js";

/**
 * Image generation for a session turn.
 * HTTP path reserves coins and enqueues BullMQ; LLM runs asynchronously.
 * Poll GET /api/jobs/:jobId (or session messages) until assistant completes.
 *
 * POST /api/generate
 * Body JSON: originalPrompt, preferences, modelId, requiredAspectRatio, requiredResolution, sessionId?
 */
export async function registerGenerateRoutes(
  app: FastifyInstance,
  generateService: GenerateService,
): Promise<void> {
  const authHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAuth(request);
  };

  app.post(
    "/api/generate",
    { preHandler: authHook },
    async (request, reply) => {
      const result = await generateController(request, generateService);
      return reply.status(202).send(result);
    },
  );
}
