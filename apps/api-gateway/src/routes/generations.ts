import type { FastifyInstance } from "fastify";
import type { GatewayConfig } from "../config.js";
import { buildDownstreamHeaders, proxyJson } from "../lib/http-client.js";
import { buildMultipartBody } from "../lib/multipart.js";

export async function registerGenerationRoutes(
  app: FastifyInstance,
  config: GatewayConfig,
): Promise<void> {
  const authHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAuth(request);
  };

  app.post(
    "/api/generate",
    { preHandler: authHook },
    async (request, reply) => {
      const form = await buildMultipartBody(request);
      const result = await proxyJson(`${config.GENERATION_WORKER_URL}/api/generate`, {
        method: "POST",
        headers: buildDownstreamHeaders(request),
        body: form,
      });

      return reply.status(result.status).send(result.body);
    },
  );

  app.post(
    "/api/generate-from-image",
    { preHandler: authHook },
    async (request, reply) => {
      const form = await buildMultipartBody(request);
      const result = await proxyJson(
        `${config.GENERATION_WORKER_URL}/api/generate-from-image`,
        {
          method: "POST",
          headers: buildDownstreamHeaders(request),
          body: form,
        },
      );

      return reply.status(result.status).send(result.body);
    },
  );
}
