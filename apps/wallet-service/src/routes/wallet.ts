import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../generated/prisma/client.js";
import type Stripe from "stripe";
import type { WalletServiceConfig } from "../config.js";
import {
  quoteBilling,
  releaseBilling,
  reserveBilling,
} from "../controllers/billing.controller.js";
import { getWalletBalance } from "../controllers/wallet.controller.js";
import {
  createPackage,
  listPackagesForAdmin,
  listPackagesForCustomer,
  patchPackage,
} from "../controllers/package.controller.js";
import { startCheckout, getPaymentStatus } from "../controllers/checkout.controller.js";

export async function registerWalletRoutes(
  app: FastifyInstance,
  deps: {
    prisma: PrismaClient;
    stripe: Stripe;
    config: WalletServiceConfig;
  },
): Promise<void> {
  const { prisma, stripe, config } = deps;

  app.addHook("onRequest", async (request) => {
    const incoming = request.headers["x-correlation-id"];
    request.correlationId =
      typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
  });

  app.get(
    "/api/wallet",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      const result = await getWalletBalance(prisma, request.user!.id);
      return reply.status(200).send(result);
    },
  );

  app.post(
    "/api/wallet/quote",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = quoteBilling(body, {
        promptEnhance: config.PROMPT_ENHANCE_COIN_COST,
        generation: config.GENERATION_COIN_COST,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    "/api/wallet/reserve",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const result = await reserveBilling(prisma, request.user!.id, body);
      return reply.status(200).send(result);
    },
  );

  /** Sync compensation path (e.g. gateway/worker before event publish). */
  app.post(
    "/api/wallet/release",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as { jobId?: string };
      const jobId = body.jobId ?? "";
      const result = await releaseBilling(prisma, request.user!.id, jobId);
      return reply.status(200).send(result);
    },
  );

  app.get(
    "/api/wallet/packages",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      if (request.user?.role === "admin") {
        const result = await listPackagesForAdmin(prisma);
        return reply.status(200).send(result);
      }
      const result = await listPackagesForCustomer(prisma);
      return reply.status(200).send(result);
    },
  );

  app.post(
    "/api/wallet/packages",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const body = request.body as {
        name?: string;
        coins?: number;
        priceCents?: number;
        currency?: string;
      };

      const result = await createPackage(prisma, stripe, {
        name: body.name ?? "",
        coins: body.coins ?? 0,
        priceCents: body.priceCents ?? 0,
        currency: body.currency,
      });

      return reply.status(201).send(result);
    },
  );

  app.patch(
    "/api/wallet/packages/:packageId",
    {
      preHandler: async (request) => {
        await app.requireAdmin(request);
      },
    },
    async (request, reply) => {
      const { packageId } = request.params as { packageId: string };
      const body = request.body as { name?: string; active?: boolean };
      const result = await patchPackage(prisma, packageId, body);
      return reply.status(200).send(result);
    },
  );

  app.post(
    "/api/wallet/checkout",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      const body = request.body as { packageId?: string };
      const result = await startCheckout(prisma, stripe, config, request.user!, {
        packageId: body.packageId ?? "",
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    "/api/wallet/payments/:sessionId",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const result = await getPaymentStatus(prisma, request.user!.id, sessionId);
      return reply.status(200).send(result);
    },
  );
}
