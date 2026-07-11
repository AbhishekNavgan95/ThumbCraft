import { baseServiceSchema, loadConfig, z } from "@platform/config";

export const configSchema = baseServiceSchema.extend({
  SERVICE_NAME: z.string().default("notification-service"),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
});

export type NotificationServiceConfig = z.infer<typeof configSchema>;

export function loadNotificationConfig(): NotificationServiceConfig {
  return loadConfig(configSchema);
}
