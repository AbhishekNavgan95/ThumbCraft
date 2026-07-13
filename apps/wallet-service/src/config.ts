import { baseServiceSchema, loadConfig, z } from "@platform/config";

export const configSchema = baseServiceSchema.extend({
  SERVICE_NAME: z.string().default("wallet-service"),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_SUCCESS_URL: z
    .string()
    .min(1)
    .default("http://localhost:5173/wallet?checkout=success&session_id={CHECKOUT_SESSION_ID}"),
  STRIPE_CANCEL_URL: z.string().url().default("http://localhost:5173/wallet?checkout=cancel"),
  WELCOME_BONUS_COINS: z.coerce.number().int().nonnegative().default(50),
});

export type WalletServiceConfig = z.infer<typeof configSchema>;

export function loadWalletConfig(): WalletServiceConfig {
  return loadConfig(configSchema);
}
