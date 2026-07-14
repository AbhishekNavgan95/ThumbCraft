/**
 * Template gallery proxies (categories + templates).
 * Auth: gateway JWT; admin mutations use requireAdmin.
 * Downstream: generation-worker /api/template-categories | /api/templates.
 */
import type { FastifyInstance } from "fastify";
import type { GatewayConfig } from "../config.js";
import { buildDownstreamHeaders, proxyJson } from "../lib/http-client.js";

export async function registerGalleryRoutes(
  app: FastifyInstance,
  config: GatewayConfig,
): Promise<void> {
  const authHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAuth(request);
  };

  const adminHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAdmin(request);
  };

  const categoriesBase = `${config.GENERATION_WORKER_URL}/api/template-categories`;
  const templatesBase = `${config.GENERATION_WORKER_URL}/api/templates`;

  // ── Categories ───────────────────────────────────────────────────
  app.get(
    "/api/template-categories",
    { preHandler: authHook },
    async (request, reply) => {
      const result = await proxyJson(categoriesBase, {
        method: "GET",
        headers: buildDownstreamHeaders(request),
      });
      return reply.status(result.status).send(result.body);
    },
  );

  app.get(
    "/api/template-categories/:categoryId",
    { preHandler: authHook },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string };
      const result = await proxyJson(
        `${categoriesBase}/${encodeURIComponent(categoryId)}`,
        {
          method: "GET",
          headers: buildDownstreamHeaders(request),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );

  app.post(
    "/api/template-categories",
    { preHandler: adminHook },
    async (request, reply) => {
      const result = await proxyJson(categoriesBase, {
        method: "POST",
        headers: {
          ...buildDownstreamHeaders(request),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request.body),
      });
      return reply.status(result.status).send(result.body);
    },
  );

  app.patch(
    "/api/template-categories/:categoryId",
    { preHandler: adminHook },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string };
      const result = await proxyJson(
        `${categoriesBase}/${encodeURIComponent(categoryId)}`,
        {
          method: "PATCH",
          headers: {
            ...buildDownstreamHeaders(request),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request.body),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );

  app.delete(
    "/api/template-categories/:categoryId",
    { preHandler: adminHook },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string };
      const result = await proxyJson(
        `${categoriesBase}/${encodeURIComponent(categoryId)}`,
        {
          method: "DELETE",
          headers: buildDownstreamHeaders(request),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );

  // ── Templates ────────────────────────────────────────────────────
  app.get(
    "/api/templates",
    { preHandler: authHook },
    async (request, reply) => {
      const query = request.url.includes("?")
        ? request.url.slice(request.url.indexOf("?"))
        : "";
      const result = await proxyJson(`${templatesBase}${query}`, {
        method: "GET",
        headers: buildDownstreamHeaders(request),
      });
      return reply.status(result.status).send(result.body);
    },
  );

  app.get(
    "/api/templates/:templateId",
    { preHandler: authHook },
    async (request, reply) => {
      const { templateId } = request.params as { templateId: string };
      const result = await proxyJson(
        `${templatesBase}/${encodeURIComponent(templateId)}`,
        {
          method: "GET",
          headers: buildDownstreamHeaders(request),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );

  app.post(
    "/api/templates",
    { preHandler: adminHook },
    async (request, reply) => {
      const result = await proxyJson(templatesBase, {
        method: "POST",
        headers: {
          ...buildDownstreamHeaders(request),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request.body),
      });
      return reply.status(result.status).send(result.body);
    },
  );

  app.patch(
    "/api/templates/:templateId",
    { preHandler: adminHook },
    async (request, reply) => {
      const { templateId } = request.params as { templateId: string };
      const result = await proxyJson(
        `${templatesBase}/${encodeURIComponent(templateId)}`,
        {
          method: "PATCH",
          headers: {
            ...buildDownstreamHeaders(request),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request.body),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );

  app.delete(
    "/api/templates/:templateId",
    { preHandler: adminHook },
    async (request, reply) => {
      const { templateId } = request.params as { templateId: string };
      const result = await proxyJson(
        `${templatesBase}/${encodeURIComponent(templateId)}`,
        {
          method: "DELETE",
          headers: buildDownstreamHeaders(request),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );
}
