import { baseServiceSchema, loadConfig, z } from "@platform/config";

export const configSchema = baseServiceSchema.extend({
  SERVICE_NAME: z.string().default("notification-service"),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  MAIL_HOST: z.string().min(1),
  MAIL_PORT: z.coerce.number().int().positive().default(587),
  MAIL_USER: z.string().email(),
  MAIL_PASSWORD: z.string().min(1),
  MAIL_FROM: z.string().optional(),
});

export type NotificationServiceConfig = z.infer<typeof configSchema>;

export function loadNotificationConfig(): NotificationServiceConfig {
  return loadConfig(configSchema);
}
