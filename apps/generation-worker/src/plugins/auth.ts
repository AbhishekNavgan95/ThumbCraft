import { AppError } from "@platform/errors";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthUser, UserRole } from "../types.js";

function parseRole(value: unknown): UserRole | null {
  return value === "customer" || value === "admin" ? value : null;
}

function userFromHeaders(request: FastifyRequest): AuthUser | null {
  const userId = request.headers["x-user-id"];
  const email = request.headers["x-user-email"];
  const name = request.headers["x-user-name"];
  const role = parseRole(request.headers["x-user-role"]);

  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    typeof email !== "string" ||
    typeof name !== "string" ||
    !role
  ) {
    return null;
  }

  return { id: userId, email, name, role };
}

export async function requireAuth(request: FastifyRequest): Promise<void> {
  const user = userFromHeaders(request);
  if (!user) {
    throw new AppError("UNAUTHORIZED", "Missing trusted user headers", 401);
  }
  request.user = user;
}

/** Attach user from trusted headers when present; otherwise no-op. */
export async function optionalAuth(request: FastifyRequest): Promise<void> {
  const user = userFromHeaders(request);
  if (user) {
    request.user = user;
  }
}

export async function requireAdmin(request: FastifyRequest): Promise<void> {
  await requireAuth(request);
  if (request.user?.role !== "admin") {
    throw new AppError("FORBIDDEN", "Admin access required", 403);
  }
}

export async function registerAuthPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest("user", undefined);
  app.decorate("requireAuth", async (request) => requireAuth(request));
  app.decorate("optionalAuth", async (request) => optionalAuth(request));
  app.decorate("requireAdmin", async (request) => requireAdmin(request));
}

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest) => Promise<void>;
    optionalAuth: (request: FastifyRequest) => Promise<void>;
    requireAdmin: (request: FastifyRequest) => Promise<void>;
  }
}
