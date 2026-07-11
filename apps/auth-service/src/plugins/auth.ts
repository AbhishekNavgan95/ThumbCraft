import { AppError } from "@platform/errors";
import type { FastifyInstance, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import type { AuthServiceConfig } from "../config.js";
import type { AuthUser } from "../types.js";

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
  config: AuthServiceConfig,
  request: FastifyRequest,
): Promise<void> {
  const userId = request.headers["x-user-id"];
  if (typeof userId === "string" && userId.length > 0) {
    const email = request.headers["x-user-email"];
    const name = request.headers["x-user-name"];
    if (typeof email === "string" && typeof name === "string") {
      request.user = { id: userId, email, name };
      return;
    }
  }

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
  config: AuthServiceConfig,
): Promise<void> {
  app.decorateRequest("user", undefined);
  app.decorate("requireAuth", async (request) => requireAuth(config, request));
}

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest) => Promise<void>;
  }
}
