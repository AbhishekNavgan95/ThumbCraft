import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { getJobController } from "./job.controller.js";

/**
 * Poll generation job status (and linked assistant message when present).
 * GET /api/jobs/:jobId
 */
export async function registerJobRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
): Promise<void> {
  const authHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAuth(request);
  };

  app.get(
    "/api/jobs/:jobId",
    { preHandler: authHook },
    async (request, reply) => {
      const result = await getJobController(request, prisma);
      return reply.status(200).send(result);
    },
  );
}
