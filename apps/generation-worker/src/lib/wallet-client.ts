import { AppError } from "@platform/errors";

export interface WalletUserHeaders {
  userId: string;
  email: string;
  name: string;
  role: string;
  correlationId?: string;
  authorization?: string;
}

export interface QuoteResult {
  kind: string;
  coinCost: number;
}

export interface ReserveResult {
  jobId: string;
  amount: number;
  balanceCoins: number;
  reservedCoins: number;
  idempotent: boolean;
}

export class WalletClient {
  constructor(private readonly baseUrl: string) {}

  async quote(
    headers: WalletUserHeaders,
    body: { kind: "prompt_enhance" | "generation" },
  ): Promise<QuoteResult> {
    return this.requestJson<QuoteResult>("/api/wallet/quote", headers, body);
  }

  async reserve(
    headers: WalletUserHeaders,
    body: { jobId: string; amount: number },
  ): Promise<ReserveResult> {
    return this.requestJson<ReserveResult>("/api/wallet/reserve", headers, body);
  }

  async release(
    headers: WalletUserHeaders,
    body: { jobId: string },
  ): Promise<{ jobId: string; amount: number }> {
    return this.requestJson("/api/wallet/release", headers, body);
  }

  private async requestJson<T>(
    path: string,
    headers: WalletUserHeaders,
    body: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": headers.userId,
          "X-User-Email": headers.email,
          "X-User-Name": headers.name,
          "X-User-Role": headers.role,
          ...(headers.correlationId
            ? { "X-Correlation-Id": headers.correlationId }
            : {}),
          ...(headers.authorization
            ? { Authorization: headers.authorization }
            : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Wallet service unreachable";
      throw new AppError("SERVICE_UNAVAILABLE", message, 503);
    }

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      details?: Record<string, unknown>;
    };

    if (!response.ok) {
      throw new AppError(
        (payload.code as AppError["code"]) ?? "INTERNAL_ERROR",
        payload.error ?? `Wallet request failed (${response.status})`,
        response.status,
        payload.details,
      );
    }

    return payload as T;
  }
}
