import { AppError } from "@platform/errors";
import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { GatewayConfig } from "../config.js";
import type { AuthUser } from "../types.js";
import type { FastifyRequest } from "fastify";

function parseAuthUser(payload: jwt.JwtPayload): AuthUser | null {
  const id = typeof payload.id === "string" ? payload.id : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  const name = typeof payload.name === "string" ? payload.name : null;

  if (!id || !email || !name) {
    return null;
  }

  return { id, email, name };
}

export async function requireAuth(
  config: GatewayConfig,
  request: FastifyRequest,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "No token provided", 401);
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    if (typeof decoded !== "object" || decoded === null) {
      throw new Error("Invalid token payload");
    }

    const user = parseAuthUser(decoded as jwt.JwtPayload);
    if (!user) {
      throw new Error("Invalid token payload");
    }

    request.user = user;
  } catch {
    throw new AppError("UNAUTHORIZED", "Invalid token", 401);
  }
}

export async function registerAuthPlugin(
  app: FastifyInstance,
  config: GatewayConfig,
): Promise<void> {
  app.decorateRequest("user", undefined);
  app.decorate("requireAuth", async (request) => requireAuth(config, request));
}

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (request: import("fastify").FastifyRequest) => Promise<void>;
  }
}
