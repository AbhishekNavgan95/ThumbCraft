/**
 * Generation + upload proxies.
 * Auth: gateway `requireAuth` verifies JWT; downstream calls include X-User-* headers.
 *
 * Generate uses JSON body (preferences + top-level prefs).
 * Uploads remain multipart.
 */
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

  const adminHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAdmin(request);
  };

  /** JWT at gateway → proxy multipart to worker internal upload. */
  app.post(
    "/api/uploads/reference",
    { preHandler: authHook },
    async (request, reply) => {
      const form = await buildMultipartBody(request);
      const result = await proxyJson(
        `${config.GENERATION_WORKER_URL}/internal/uploads/reference`,
        {
          method: "POST",
          headers: buildDownstreamHeaders(request),
          body: form,
        },
      );

      return reply.status(result.status).send(result.body);
    },
  );

  /** Admin gallery image → templates/ folder on S3. */
  app.post(
    "/api/uploads/template",
    { preHandler: adminHook },
    async (request, reply) => {
      const form = await buildMultipartBody(request);
      const result = await proxyJson(
        `${config.GENERATION_WORKER_URL}/internal/uploads/template`,
        {
          method: "POST",
          headers: buildDownstreamHeaders(request),
          body: form,
        },
      );

      return reply.status(result.status).send(result.body);
    },
  );

  app.post(
    "/api/generate",
    { preHandler: authHook },
    async (request, reply) => {
      const result = await proxyJson(`${config.GENERATION_WORKER_URL}/api/generate`, {
        method: "POST",
        headers: {
          ...buildDownstreamHeaders(request),
          "Content-Type": "application/json",
          ...(typeof request.headers["idempotency-key"] === "string"
            ? { "Idempotency-Key": request.headers["idempotency-key"] }
            : {}),
        },
        body: JSON.stringify(request.body ?? {}),
      });

      return reply.status(result.status).send(result.body);
    },
  );

  app.get(
    "/api/jobs/:jobId",
    { preHandler: authHook },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const result = await proxyJson(
        `${config.GENERATION_WORKER_URL}/api/jobs/${encodeURIComponent(jobId)}`,
        {
          method: "GET",
          headers: buildDownstreamHeaders(request),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );

  app.get(
    "/api/sessions/:sessionId/messages",
    { preHandler: authHook },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const result = await proxyJson(
        `${config.GENERATION_WORKER_URL}/api/sessions/${encodeURIComponent(sessionId)}/messages`,
        {
          method: "GET",
          headers: buildDownstreamHeaders(request),
        },
      );
      return reply.status(result.status).send(result.body);
    },
  );
}
