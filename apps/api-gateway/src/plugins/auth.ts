import { AppError } from "@platform/errors";
import type { FastifyInstance, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import type { GatewayConfig } from "../config.js";
import type { AuthUser, UserRole } from "../types.js";

function parseRole(value: unknown): UserRole | null {
  return value === "customer" || value === "admin" ? value : null;
}

function parseAuthUser(payload: jwt.JwtPayload): AuthUser | null {
  const id = typeof payload.id === "string" ? payload.id : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  const name = typeof payload.name === "string" ? payload.name : null;
  const role = parseRole(payload.role) ?? "customer";

  if (!id || !email || !name) {
    return null;
  }

  return { id, email, name, role };
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

/** Attach user when a valid Bearer token is present; otherwise no-op. */
export async function optionalAuth(
  config: GatewayConfig,
  request: FastifyRequest,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    if (typeof decoded !== "object" || decoded === null) {
      return;
    }

    const user = parseAuthUser(decoded as jwt.JwtPayload);
    if (user) {
      request.user = user;
    }
  } catch {
    // Public routes ignore invalid tokens.
  }
}

export async function requireAdmin(
  config: GatewayConfig,
  request: FastifyRequest,
): Promise<void> {
  await requireAuth(config, request);
  if (request.user?.role !== "admin") {
    throw new AppError("FORBIDDEN", "Admin access required", 403);
  }
}

export async function registerAuthPlugin(
  app: FastifyInstance,
  config: GatewayConfig,
): Promise<void> {
  app.decorateRequest("user", undefined);
  app.decorate("requireAuth", async (request) => requireAuth(config, request));
  app.decorate("optionalAuth", async (request) => optionalAuth(config, request));
  app.decorate("requireAdmin", async (request) => requireAdmin(config, request));
}

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest) => Promise<void>;
    optionalAuth: (request: FastifyRequest) => Promise<void>;
    requireAdmin: (request: FastifyRequest) => Promise<void>;
  }
}
