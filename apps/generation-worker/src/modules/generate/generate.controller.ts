import { randomUUID } from "node:crypto";
import { AppError } from "@platform/errors";
import type { FastifyRequest } from "fastify";
import type { WalletUserHeaders } from "../../lib/wallet-client.js";
import type { GenerateService } from "./generate.service.js";
import { parseGenerateBody } from "./generate.validation.js";

function userHeadersFromRequest(request: FastifyRequest): WalletUserHeaders {
  const user = request.user;
  if (!user) {
    throw new AppError("UNAUTHORIZED", "Missing authenticated user", 401);
  }

  const authorization = request.headers.authorization;
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    correlationId: request.correlationId,
    authorization:
      typeof authorization === "string" ? authorization : undefined,
  };
}

export async function generateController(
  request: FastifyRequest,
  generateService: GenerateService,
) {
  const body = parseGenerateBody((request.body ?? {}) as Record<string, unknown>);
  const idempotencyKeyHeader = request.headers["idempotency-key"];
  const idempotencyKey =
    typeof idempotencyKeyHeader === "string" && idempotencyKeyHeader.trim()
      ? idempotencyKeyHeader.trim()
      : `generate:${request.user!.id}:${randomUUID()}`;

  return generateService.generate({
    user: userHeadersFromRequest(request),
    body,
    correlationId: request.correlationId ?? randomUUID(),
    idempotencyKey,
  });
}
