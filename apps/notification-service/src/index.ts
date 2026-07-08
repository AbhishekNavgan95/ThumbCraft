import { loadConfig, baseServiceSchema, z } from "@platform/config";
import { createLogger } from "@platform/logger";

const configSchema = baseServiceSchema.extend({
  SERVICE_NAME: z.string().default("notification-service"),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
});

const config = loadConfig(configSchema);
const logger = createLogger({ service: config.SERVICE_NAME, level: config.LOG_LEVEL });

logger.info(
  { port: config.PORT, smtpHost: config.SMTP_HOST },
  "notification service initialized (consumer wiring pending)",
);
