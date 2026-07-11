import { AppError } from "@platform/errors";
import type { FastifyRequest } from "fastify";

export interface ProxyResponse {
  status: number;
  body: unknown;
  contentType: string | null;
}

export function buildDownstreamHeaders(
  request: FastifyRequest,
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Correlation-Id": request.correlationId,
    ...extra,
  };

  const authorization = request.headers.authorization;
  if (authorization) {
    headers.Authorization = authorization;
  }

  if (request.user?.id) {
    headers["X-User-Id"] = request.user.id;
  }

  return headers;
}

export async function proxyJson(
  url: string,
  init: RequestInit,
): Promise<ProxyResponse> {
  try {
    const response = await fetch(url, init);
    const contentType = response.headers.get("content-type");
    const body = contentType?.includes("application/json")
      ? await response.json()
      : await response.text();

    return { status: response.status, body, contentType };
  } catch {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "Downstream service is unavailable",
      503,
    );
  }
}

export async function checkServiceHealth(
  baseUrl: string,
): Promise<"ok" | "unavailable"> {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
    return response.ok ? "ok" : "unavailable";
  } catch {
    return "unavailable";
  }
}
