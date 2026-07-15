import type { FastifyInstance } from "fastify";
import { enhancePromptController } from "./enhance.controller.js";
import type { EnhanceService } from "./enhance.service.js";

/**
 * Prompt enhancement — billed as GenerationJob kind=prompt_enhance.
 * Public path via gateway: POST /api/enhance-prompt
 */
export async function registerEnhanceRoutes(
  app: FastifyInstance,
  enhanceService: EnhanceService,
): Promise<void> {
  app.post(
    "/api/enhance-prompt",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      const body = await enhancePromptController(request, enhanceService);
      return reply.status(200).send(body);
    },
  );
}
