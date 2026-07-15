/**
 * Prompt enhance proxy → generation-worker.
 * Billing (quote/reserve/capture) is orchestrated inside the worker;
 * wallet capture/release happens via generation.completed|failed events.
 */
import type { FastifyInstance } from "fastify";
import type { GatewayConfig } from "../config.js";
import { buildDownstreamHeaders, proxyJson } from "../lib/http-client.js";

export async function registerEnhanceRoutes(
  app: FastifyInstance,
  config: GatewayConfig,
): Promise<void> {
  const authHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAuth(request);
  };

  app.post(
    "/api/enhance-prompt",
    { preHandler: authHook },
    async (request, reply) => {
      const headers: Record<string, string> = {
        ...buildDownstreamHeaders(request),
        "Content-Type": "application/json",
      };

      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey === "string" && idempotencyKey.length > 0) {
        headers["Idempotency-Key"] = idempotencyKey;
      }

      const result = await proxyJson(
        `${config.GENERATION_WORKER_URL}/api/enhance-prompt`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(request.body),
        },
      );

      return reply.status(result.status).send(result.body);
    },
  );
}
