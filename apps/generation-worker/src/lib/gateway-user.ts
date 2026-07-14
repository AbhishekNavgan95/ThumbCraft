import { AppError } from "@platform/errors";
import type { FastifyRequest } from "fastify";

/**
 * Read the authenticated user id forwarded by API Gateway after JWT verification.
 * Generation-worker does not validate JWTs — that belongs to auth-service + gateway.
 */
export function requireGatewayUserId(request: FastifyRequest): string {
  const userId = request.headers["x-user-id"];
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new AppError(
      "UNAUTHORIZED",
      "Missing X-User-Id from API Gateway",
      401,
    );
  }
  return userId.trim();
}

export function optionalHeader(
  request: FastifyRequest,
  name: "x-user-email" | "x-user-name" | "x-user-role" | "x-correlation-id",
): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
