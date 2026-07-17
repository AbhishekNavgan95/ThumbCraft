import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { listSessionMessagesController } from "./message.controller.js";

/**
 * Message reads for a session thread.
 * Writes happen through the generate module.
 */
export async function registerMessageRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
): Promise<void> {
  const authHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAuth(request);
  };

  app.get(
    "/api/sessions/:sessionId/messages",
    { preHandler: authHook },
    async (request, reply) => {
      const userId = request.user!.id;
      const { sessionId } = request.params as { sessionId: string };
      return reply
        .status(200)
        .send(await listSessionMessagesController(prisma, userId, sessionId));
    },
  );
}
