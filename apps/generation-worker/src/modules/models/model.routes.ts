import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  createGenerationModel,
  getModelForAdmin,
  getModelForCustomer,
  listModelsForAdmin,
  listModelsForCustomer,
  patchGenerationModel,
  removeGenerationModel,
} from "./model.controller.js";

/**
 * Model catalog API — called by API Gateway after JWT auth.
 * Customer list returns visible models only; admin list returns all.
 */
export async function registerModelRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
): Promise<void> {
  app.get(
    "/api/models",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      if (request.user?.role === "admin") {
        return reply.status(200).send(await listModelsForAdmin(prisma));
      }
      return reply.status(200).send(await listModelsForCustomer(prisma));
    },
  );

  app.get(
    "/api/models/:modelId",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      const { modelId } = request.params as { modelId: string };
      if (request.user?.role === "admin") {
        return reply.status(200).send(await getModelForAdmin(prisma, modelId));
      }
      return reply
        .status(200)
        .send(await getModelForCustomer(prisma, modelId));
    },
  );

  app.post(
    "/api/models",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await createGenerationModel(prisma, body);
      return reply.status(201).send(result);
    },
  );

  app.patch(
    "/api/models/:modelId",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const { modelId } = request.params as { modelId: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await patchGenerationModel(prisma, modelId, body);
      return reply.status(200).send(result);
    },
  );

  app.delete(
    "/api/models/:modelId",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const { modelId } = request.params as { modelId: string };
      const result = await removeGenerationModel(prisma, modelId);
      return reply.status(200).send(result);
    },
  );
}
