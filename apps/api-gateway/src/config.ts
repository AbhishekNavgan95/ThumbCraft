import { baseServiceSchema, loadConfig, z } from "@platform/config";

export const configSchema = baseServiceSchema.extend({
  SERVICE_NAME: z.string().default("api-gateway"),
  AUTH_SERVICE_URL: z.string().url(),
  WALLET_SERVICE_URL: z.string().url(),
  GENERATION_WORKER_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
});

export type GatewayConfig = z.infer<typeof configSchema>;

export function loadGatewayConfig(): GatewayConfig {
  return loadConfig(configSchema);
}
