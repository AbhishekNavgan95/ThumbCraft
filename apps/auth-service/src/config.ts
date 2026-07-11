import { baseServiceSchema, loadConfig, z } from "@platform/config";

export const configSchema = baseServiceSchema.extend({
  SERVICE_NAME: z.string().default("auth-service"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  RABBITMQ_URL: z.string().url(),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
});

export type AuthServiceConfig = z.infer<typeof configSchema>;

export function loadAuthConfig(): AuthServiceConfig {
  return loadConfig(configSchema);
}
