import type { FastifyInstance } from "fastify";
import type { GatewayConfig } from "../config.js";
import { buildDownstreamHeaders, proxyJson } from "../lib/http-client.js";

export async function registerWalletRoutes(
  app: FastifyInstance,
  config: GatewayConfig,
): Promise<void> {
  const authHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAuth(request);
  };

  const adminHook = async (request: import("fastify").FastifyRequest) => {
    await app.requireAdmin(request);
  };

  app.get(
    "/api/wallet",
    { preHandler: authHook },
    async (request, reply) => {
      const result = await proxyJson(`${config.WALLET_SERVICE_URL}/api/wallet`, {
        method: "GET",
        headers: buildDownstreamHeaders(request),
      });

      return reply.status(result.status).send(result.body);
    },
  );

  app.get(
    "/api/wallet/packages",
    { preHandler: authHook },
    async (request, reply) => {
      const result = await proxyJson(`${config.WALLET_SERVICE_URL}/api/wallet/packages`, {
        method: "GET",
        headers: buildDownstreamHeaders(request),
      });

      return reply.status(result.status).send(result.body);
    },
  );

  app.post(
    "/api/wallet/quote",
    { preHandler: authHook },
    async (request, reply) => {
      const result = await proxyJson(`${config.WALLET_SERVICE_URL}/api/wallet/quote`, {
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

  app.post(
    "/api/wallet/reserve",
    { preHandler: authHook },
    async (request, reply) => {
      const result = await proxyJson(`${config.WALLET_SERVICE_URL}/api/wallet/reserve`, {
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

  app.post(
    "/api/wallet/release",
    { preHandler: authHook },
    async (request, reply) => {
      const result = await proxyJson(`${config.WALLET_SERVICE_URL}/api/wallet/release`, {
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

  app.post(
    "/api/wallet/checkout",
    { preHandler: authHook },
    async (request, reply) => {
      const result = await proxyJson(`${config.WALLET_SERVICE_URL}/api/wallet/checkout`, {
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

  app.get(
    "/api/wallet/payments/:sessionId",
    { preHandler: authHook },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const result = await proxyJson(
        `${config.WALLET_SERVICE_URL}/api/wallet/payments/${encodeURIComponent(sessionId)}`,
        {
          method: "GET",
          headers: buildDownstreamHeaders(request),
        },
      );

      return reply.status(result.status).send(result.body);
    },
  );

  app.get(
    "/api/wallet/transactions",
    { preHandler: authHook },
    async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const params = new URLSearchParams();
      if (query.limit) params.set("limit", query.limit);
      if (query.cursor) params.set("cursor", query.cursor);
      const qs = params.toString();

      const result = await proxyJson(
        `${config.WALLET_SERVICE_URL}/api/wallet/transactions${qs ? `?${qs}` : ""}`,
        {
          method: "GET",
          headers: buildDownstreamHeaders(request),
        },
      );

      return reply.status(result.status).send(result.body);
    },
  );

  app.post(
    "/api/wallet/packages",
    { preHandler: adminHook },
    async (request, reply) => {
      const result = await proxyJson(`${config.WALLET_SERVICE_URL}/api/wallet/packages`, {
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
    "/api/wallet/packages/:packageId",
    { preHandler: adminHook },
    async (request, reply) => {
      const { packageId } = request.params as { packageId: string };
      const result = await proxyJson(
        `${config.WALLET_SERVICE_URL}/api/wallet/packages/${packageId}`,
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

  // Stripe webhooks must hit wallet-service directly (signature uses raw body).
  // Expose a passthrough only if needed later; do not proxy through gateway JSON parser.
}
