import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTestGatewayApp,
  signTestJwt,
  testGatewayConfig,
} from "../test/helpers.js";

describe("api-gateway generate proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects missing JWT with 401", async () => {
    const app = await createTestGatewayApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/generate",
      payload: { originalPrompt: "x" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: "UNAUTHORIZED",
      error: "No token provided",
    });

    await app.close();
  });

  it("forwards X-Correlation-Id and Idempotency-Key to the worker", async () => {
    const config = testGatewayConfig();
    const fetchMock = vi.fn(async () =>
      Response.json(
        { ok: true, job: { id: "job-1", status: "processing" } },
        { status: 202 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const app = await createTestGatewayApp(config);
    const token = signTestJwt({
      id: "22222222-2222-4222-8222-222222222222",
      email: "fwd@example.com",
      name: "Forward User",
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/generate",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": "client-key-abc",
        "x-correlation-id": "corr-xyz",
        "content-type": "application/json",
      },
      payload: {
        originalPrompt: "neon thumbnail",
        modelId: "33333333-3333-4333-8333-333333333333",
        requiredAspectRatio: "16:9",
        requiredResolution: "1K",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${config.GENERATION_WORKER_URL}/api/generate`);

    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Correlation-Id"]).toBe("corr-xyz");
    expect(headers["Idempotency-Key"]).toBe("client-key-abc");
    expect(headers.Authorization).toBe(`Bearer ${token}`);
    expect(headers["X-User-Id"]).toBe("22222222-2222-4222-8222-222222222222");
    expect(headers["X-User-Email"]).toBe("fwd@example.com");
    expect(headers["X-User-Name"]).toBe("Forward User");
    expect(headers["X-User-Role"]).toBe("customer");

    await app.close();
  });
});
