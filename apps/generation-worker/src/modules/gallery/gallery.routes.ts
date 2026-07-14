import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  createTemplateCategory,
  getCategoryForAdmin,
  getCategoryForCustomer,
  listCategoriesForAdmin,
  listCategoriesForCustomer,
  patchTemplateCategory,
  removeTemplateCategory,
} from "./category.controller.js";
import {
  createThumbnailTemplate,
  getTemplateForAdmin,
  getTemplateForCustomer,
  listTemplatesForAdmin,
  listTemplatesForCustomer,
  patchThumbnailTemplate,
  removeThumbnailTemplate,
} from "./template.controller.js";

/**
 * Template gallery API — categories + thumbnail templates.
 * Customers see active items; admins manage full CRUD.
 */
export async function registerGalleryRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
): Promise<void> {
  // ── Categories ───────────────────────────────────────────────────
  app.get(
    "/api/template-categories",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      if (request.user?.role === "admin") {
        return reply.status(200).send(await listCategoriesForAdmin(prisma));
      }
      return reply.status(200).send(await listCategoriesForCustomer(prisma));
    },
  );

  app.get(
    "/api/template-categories/:categoryId",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string };
      if (request.user?.role === "admin") {
        return reply
          .status(200)
          .send(await getCategoryForAdmin(prisma, categoryId));
      }
      return reply
        .status(200)
        .send(await getCategoryForCustomer(prisma, categoryId));
    },
  );

  app.post(
    "/api/template-categories",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await createTemplateCategory(prisma, body);
      return reply.status(201).send(result);
    },
  );

  app.patch(
    "/api/template-categories/:categoryId",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await patchTemplateCategory(prisma, categoryId, body);
      return reply.status(200).send(result);
    },
  );

  app.delete(
    "/api/template-categories/:categoryId",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string };
      const result = await removeTemplateCategory(prisma, categoryId);
      return reply.status(200).send(result);
    },
  );

  // ── Templates ────────────────────────────────────────────────────
  app.get(
    "/api/templates",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      if (request.user?.role === "admin") {
        return reply
          .status(200)
          .send(await listTemplatesForAdmin(prisma, request.query));
      }
      return reply
        .status(200)
        .send(await listTemplatesForCustomer(prisma, request.query));
    },
  );

  app.get(
    "/api/templates/:templateId",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      const { templateId } = request.params as { templateId: string };
      if (request.user?.role === "admin") {
        return reply
          .status(200)
          .send(await getTemplateForAdmin(prisma, templateId));
      }
      return reply
        .status(200)
        .send(await getTemplateForCustomer(prisma, templateId));
    },
  );

  app.post(
    "/api/templates",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await createThumbnailTemplate(
        prisma,
        body,
        request.user!.id,
      );
      return reply.status(201).send(result);
    },
  );

  app.patch(
    "/api/templates/:templateId",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const { templateId } = request.params as { templateId: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await patchThumbnailTemplate(prisma, templateId, body);
      return reply.status(200).send(result);
    },
  );

  app.delete(
    "/api/templates/:templateId",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const { templateId } = request.params as { templateId: string };
      const result = await removeThumbnailTemplate(prisma, templateId);
      return reply.status(200).send(result);
    },
  );
}
