import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  createSessionController,
  deleteSessionController,
  getSessionController,
  listSessionsController,
  patchSessionController,
} from "./session.controller.js";

/**
 * Generation sessions CRUD — called by API Gateway after JWT auth.
 *
 * POST /api/sessions reuses an empty active session (0 messages) when one
 * exists so silent frontend bootstrap does not accumulate dead sessions.
 */
export async function registerSessionRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
): Promise<void> {
  const authHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAuth(request);
  };

  app.post(
    "/api/sessions",
    { preHandler: authHook },
    async (request, reply) => {
      const userId = request.user!.id;
      // title/category optional — worker defaults to "New session" / "default"
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await createSessionController(prisma, userId, body);
      return reply.status(result.reused ? 200 : 201).send(result);
    },
  );

  app.get(
    "/api/sessions",
    { preHandler: authHook },
    async (request, reply) => {
      const userId = request.user!.id;
      const query = request.query as Record<string, unknown>;
      return reply
        .status(200)
        .send(await listSessionsController(prisma, userId, query));
    },
  );

  app.get(
    "/api/sessions/:sessionId",
    { preHandler: authHook },
    async (request, reply) => {
      const userId = request.user!.id;
      const { sessionId } = request.params as { sessionId: string };
      return reply
        .status(200)
        .send(await getSessionController(prisma, userId, sessionId));
    },
  );

  app.patch(
    "/api/sessions/:sessionId",
    { preHandler: authHook },
    async (request, reply) => {
      const userId = request.user!.id;
      const { sessionId } = request.params as { sessionId: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      return reply
        .status(200)
        .send(await patchSessionController(prisma, userId, sessionId, body));
    },
  );

  app.delete(
    "/api/sessions/:sessionId",
    { preHandler: authHook },
    async (request, reply) => {
      const userId = request.user!.id;
      const { sessionId } = request.params as { sessionId: string };
      return reply
        .status(200)
        .send(await deleteSessionController(prisma, userId, sessionId));
    },
  );
}
