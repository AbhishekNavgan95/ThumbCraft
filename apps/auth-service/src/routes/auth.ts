import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import type { AuthServiceConfig } from "../config.js";
import {
  registerAdmin,
  validateAdminRegisterInput,
} from "../controllers/admin-register.controller.js";
import { login, validateLoginInput } from "../controllers/login.controller.js";
import { getProfile } from "../controllers/profile.controller.js";
import { signup, validateSignupInput } from "../controllers/signup.controller.js";
import { validateVerifyOtpInput, verifyOtp } from "../controllers/verify-otp.controller.js";

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: {
    prisma: PrismaClient;
    rabbitmq: RabbitMQClient;
    config: AuthServiceConfig;
  },
): Promise<void> {
  const { prisma, rabbitmq, config } = deps;

  app.addHook("onRequest", async (request) => {
    const incoming = request.headers["x-correlation-id"];
    request.correlationId =
      typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
  });

  app.post("/api/signup", async (request, reply) => {
    const body = request.body as { name?: string; email?: string; password?: string };
    const input = {
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
    };

    validateSignupInput(input);
    const result = await signup(
      prisma,
      rabbitmq,
      config,
      input,
      request.correlationId ?? randomUUID(),
    );

    return reply.status(201).send(result);
  });

  app.post("/api/admin/register", async (request, reply) => {
    const body = request.body as {
      name?: string;
      email?: string;
      password?: string;
      inviteSecret?: string;
    };
    const input = {
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      inviteSecret: body.inviteSecret ?? "",
    };

    validateAdminRegisterInput(input);
    const result = await registerAdmin(
      prisma,
      rabbitmq,
      config,
      input,
      request.correlationId ?? randomUUID(),
    );

    return reply.status(201).send(result);
  });

  app.post("/api/verify-otp", async (request, reply) => {
    const body = request.body as { email?: string; otp?: string };
    const input = {
      email: body.email ?? "",
      otp: body.otp ?? "",
    };

    validateVerifyOtpInput(input);
    const result = await verifyOtp(
      prisma,
      rabbitmq,
      config,
      input,
      request.correlationId ?? randomUUID(),
    );

    return reply.status(200).send(result);
  });

  app.post("/api/login", async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const input = {
      email: body.email ?? "",
      password: body.password ?? "",
    };

    validateLoginInput(input);
    const result = await login(prisma, config, input);

    return reply.status(200).send(result);
  });

  app.get(
    "/api/profile",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({ error: "Not authenticated" });
      }

      const result = await getProfile(prisma, request.user.id);
      return reply.status(200).send(result);
    },
  );
}
