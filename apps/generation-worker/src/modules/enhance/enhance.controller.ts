import { randomUUID } from "node:crypto";
import { AppError } from "@platform/errors";
import type { FastifyRequest } from "fastify";
import type { WalletUserHeaders } from "../../lib/wallet-client.js";
import type { EnhanceService } from "./enhance.service.js";

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

export async function enhancePromptController(
  request: FastifyRequest,
  enhanceService: EnhanceService,
) {
  const body = (request.body ?? {}) as {
    prompt?: unknown;
    idempotencyKey?: unknown;
  };

  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "prompt is required", 422);
  }

  const prompt = body.prompt.trim();
  if (prompt.length > 4000) {
    throw new AppError(
      "VALIDATION_ERROR",
      "prompt must be at most 4000 characters",
      422,
    );
  }

  const headerKey = request.headers["idempotency-key"];
  const idempotencyKey =
    (typeof body.idempotencyKey === "string" &&
    body.idempotencyKey.trim().length > 0
      ? body.idempotencyKey.trim()
      : undefined) ??
    (typeof headerKey === "string" && headerKey.trim().length > 0
      ? headerKey.trim()
      : `enhance:${request.user!.id}:${randomUUID()}`);

  return enhanceService.enhancePrompt({
    user: userHeadersFromRequest(request),
    originalPrompt: prompt,
    idempotencyKey,
    correlationId: request.correlationId ?? randomUUID(),
  });
}
