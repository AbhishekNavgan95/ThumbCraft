import { createLogger } from "@platform/logger";
import jwt from "jsonwebtoken";
import { createApp } from "../app.js";
import type { GatewayConfig } from "../config.js";

export const TEST_JWT_SECRET = "test-jwt-secret-16chars-min";

export function testGatewayConfig(
  overrides?: Partial<GatewayConfig>,
): GatewayConfig {
  return {
    NODE_ENV: "test",
    PORT: 3000,
    LOG_LEVEL: "fatal",
    SERVICE_NAME: "api-gateway",
    AUTH_SERVICE_URL: "http://auth.test",
    WALLET_SERVICE_URL: "http://wallet.test",
    GENERATION_WORKER_URL: "http://generation.test",
    RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
    JWT_SECRET: TEST_JWT_SECRET,
    ...overrides,
  };
}

export function signTestJwt(payload?: {
  id?: string;
  email?: string;
  name?: string;
  role?: "customer" | "admin";
}) {
  return jwt.sign(
    {
      id: payload?.id ?? "11111111-1111-4111-8111-111111111111",
      email: payload?.email ?? "user@example.com",
      name: payload?.name ?? "Test User",
      role: payload?.role ?? "customer",
    },
    TEST_JWT_SECRET,
    { expiresIn: "1h" },
  );
}

export async function createTestGatewayApp(config = testGatewayConfig()) {
  const logger = createLogger({ service: "api-gateway-test", level: "silent" });
  return createApp(config, logger);
}
