import type { FastifyInstance } from "fastify";
import type { GatewayConfig } from "../config.js";
import { buildDownstreamHeaders, proxyJson } from "../lib/http-client.js";

export async function registerAuthRoutes(
  app: FastifyInstance,
  config: GatewayConfig,
): Promise<void> {
  app.post("/api/signup", async (request, reply) => {
    const result = await proxyJson(`${config.AUTH_SERVICE_URL}/api/signup`, {
      method: "POST",
      headers: {
        ...buildDownstreamHeaders(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.body),
    });

    return reply.status(result.status).send(result.body);
  });

  app.post("/api/login", async (request, reply) => {
    const result = await proxyJson(`${config.AUTH_SERVICE_URL}/api/login`, {
      method: "POST",
      headers: {
        ...buildDownstreamHeaders(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.body),
    });

    return reply.status(result.status).send(result.body);
  });

  app.post("/api/verify-otp", async (request, reply) => {
    const result = await proxyJson(`${config.AUTH_SERVICE_URL}/api/verify-otp`, {
      method: "POST",
      headers: {
        ...buildDownstreamHeaders(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.body),
    });

    return reply.status(result.status).send(result.body);
  });

  app.get(
    "/api/profile",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      const result = await proxyJson(`${config.AUTH_SERVICE_URL}/api/profile`, {
        method: "GET",
        headers: buildDownstreamHeaders(request),
      });

      return reply.status(result.status).send(result.body);
    },
  );
}
