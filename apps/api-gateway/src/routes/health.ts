import type { FastifyInstance } from "fastify";
import type { GatewayConfig } from "../config.js";
import { checkServiceHealth } from "../lib/http-client.js";

export async function registerHealthRoutes(
  app: FastifyInstance,
  config: GatewayConfig,
): Promise<void> {
  app.get("/health", async () => {
    const [auth, wallet, generation] = await Promise.all([
      checkServiceHealth(config.AUTH_SERVICE_URL),
      checkServiceHealth(config.WALLET_SERVICE_URL),
      checkServiceHealth(config.GENERATION_WORKER_URL),
    ]);

    return {
      status: "ok",
      service: config.SERVICE_NAME,
      services: {
        auth,
        wallet,
        generation,
      },
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/ready", async () => ({
    status: "ready",
    service: config.SERVICE_NAME,
  }));
}
