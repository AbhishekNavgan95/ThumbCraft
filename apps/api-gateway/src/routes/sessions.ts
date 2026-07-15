/**
 * Generation session proxies.
 * Auth: gateway JWT → X-User-* headers to generation-worker.
 *
 * POST /api/sessions is idempotent for empty sessions: worker reuses an
 * existing active session with 0 messages (silent frontend bootstrap).
 */
import type { FastifyInstance } from "fastify";
import type { GatewayConfig } from "../config.js";
import { buildDownstreamHeaders, proxyJson } from "../lib/http-client.js";

export async function registerSessionRoutes(
  app: FastifyInstance,
  config: GatewayConfig,
): Promise<void> {
  const authHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAuth(request);
  };

  const base = `${config.GENERATION_WORKER_URL}/api/sessions`;

  app.post("/api/sessions", { preHandler: authHook }, async (request, reply) => {
    const result = await proxyJson(base, {
      method: "POST",
      headers: {
        ...buildDownstreamHeaders(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.body ?? {}),
    });
    app.log.info(`[SESSIONS] Session created: ${JSON.stringify(result.body)}`);
    return reply.status(result.status).send(result.body);
  });

  app.get("/api/sessions", { preHandler: authHook }, async (request, reply) => {
    const url = new URL(base);
    const query = request.query as Record<string, unknown>;
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
    const result = await proxyJson(url.toString(), {
      method: "GET",
      headers: buildDownstreamHeaders(request),
    });
    return reply.status(result.status).send(result.body);
  });

  app.get(
    "/api/sessions/:sessionId",
    { preHandler: authHook },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const result = await proxyJson(
        `${base}/${encodeURIComponent(sessionId)}`,
        {
          method: "GET",
          headers: buildDownstreamHeaders(request),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );

  app.patch(
    "/api/sessions/:sessionId",
    { preHandler: authHook },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const result = await proxyJson(
        `${base}/${encodeURIComponent(sessionId)}`,
        {
          method: "PATCH",
          headers: {
            ...buildDownstreamHeaders(request),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request.body ?? {}),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );

  app.delete(
    "/api/sessions/:sessionId",
    { preHandler: authHook },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const result = await proxyJson(
        `${base}/${encodeURIComponent(sessionId)}`,
        {
          method: "DELETE",
          headers: buildDownstreamHeaders(request),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );
}
