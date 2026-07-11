import type { FastifyInstance } from "fastify";
import type { GatewayConfig } from "../config.js";
import { buildDownstreamHeaders, proxyJson } from "../lib/http-client.js";

export async function registerHistoryRoutes(
  app: FastifyInstance,
  config: GatewayConfig,
): Promise<void> {
  const authHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAuth(request);
  };

  app.get(
    "/api/history",
    { preHandler: authHook },
    async (request, reply) => {
      const query = new URLSearchParams();
      const { limit, offset } = request.query as { limit?: string; offset?: string };

      if (limit) query.set("limit", limit);
      if (offset) query.set("offset", offset);

      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      const result = await proxyJson(
        `${config.GENERATION_WORKER_URL}/api/history${suffix}`,
        {
          method: "GET",
          headers: buildDownstreamHeaders(request),
        },
      );

      return reply.status(result.status).send(result.body);
    },
  );

  app.delete(
    "/api/history/:historyId",
    { preHandler: authHook },
    async (request, reply) => {
      const { historyId } = request.params as { historyId: string };
      const result = await proxyJson(
        `${config.GENERATION_WORKER_URL}/api/history/${historyId}`,
        {
          method: "DELETE",
          headers: buildDownstreamHeaders(request),
        },
      );

      return reply.status(result.status).send(result.body);
    },
  );

  app.delete(
    "/api/history",
    { preHandler: authHook },
    async (request, reply) => {
      const result = await proxyJson(`${config.GENERATION_WORKER_URL}/api/history`, {
        method: "DELETE",
        headers: buildDownstreamHeaders(request),
      });

      return reply.status(result.status).send(result.body);
    },
  );
}
