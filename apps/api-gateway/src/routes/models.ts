/**
 * Generation model catalog proxies.
 * Auth: gateway JWT; admin mutations use requireAdmin.
 * Downstream: generation-worker /api/models (+ X-User-* headers).
 */
import type { FastifyInstance } from "fastify";
import type { GatewayConfig } from "../config.js";
import { buildDownstreamHeaders, proxyJson } from "../lib/http-client.js";

export async function registerModelRoutes(
  app: FastifyInstance,
  config: GatewayConfig,
): Promise<void> {
  const authHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAuth(request);
  };

  const adminHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAdmin(request);
  };

  const base = `${config.GENERATION_WORKER_URL}/api/models`;

  app.get("/api/models", { preHandler: authHook }, async (request, reply) => {
    const result = await proxyJson(base, {
      method: "GET",
      headers: buildDownstreamHeaders(request),
    });
    return reply.status(result.status).send(result.body);
  });

  app.get(
    "/api/models/:modelId",
    { preHandler: authHook },
    async (request, reply) => {
      const { modelId } = request.params as { modelId: string };
      const result = await proxyJson(
        `${base}/${encodeURIComponent(modelId)}`,
        {
          method: "GET",
          headers: buildDownstreamHeaders(request),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );

  app.post("/api/models", { preHandler: adminHook }, async (request, reply) => {
    const result = await proxyJson(base, {
      method: "POST",
      headers: {
        ...buildDownstreamHeaders(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.body),
    });
    return reply.status(result.status).send(result.body);
  });

  app.patch(
    "/api/models/:modelId",
    { preHandler: adminHook },
    async (request, reply) => {
      const { modelId } = request.params as { modelId: string };
      const result = await proxyJson(
        `${base}/${encodeURIComponent(modelId)}`,
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
    "/api/models/:modelId",
    { preHandler: adminHook },
    async (request, reply) => {
      const { modelId } = request.params as { modelId: string };
      const result = await proxyJson(
        `${base}/${encodeURIComponent(modelId)}`,
        {
          method: "DELETE",
          headers: buildDownstreamHeaders(request),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );
}
