import { baseServiceSchema, loadConfig, z } from "@platform/config";

export const configSchema = baseServiceSchema.extend({
  SERVICE_NAME: z.string().default("generation-worker"),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),

  /** Redis for BullMQ image-generation jobs. */
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  /** Wallet service base URL for sync quote/reserve (capture/release via events). */
  WALLET_SERVICE_URL: z.string().url().default("http://localhost:3002"),

  /** Google AI / Gemini Interactions API key (image generation). */
  GEMINI_API_KEY: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  /** Chat model used for prompt enhancement. */
  OPENAI_ENHANCE_MODEL: z.string().min(1).default("gpt-5-mini"),

  AWS_REGION: z.string().min(1).default("us-east-1"),
  AWS_S3_BUCKET: z.string().min(1).optional(),
  /** Optional when using instance/profile IAM role. */
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  /**
   * Public CDN / bucket base URL used when returning image URLs to clients.
   * Example: https://cdn.thumbcraft.example or https://bucket.s3.amazonaws.com
   * If omitted, virtual-hosted-style S3 URLs are built from region + bucket.
   */
  AWS_S3_PUBLIC_BASE_URL: z.string().url().optional(),

  /**
   * When true, skip the real image LLM and return a placeholder image.
   * Use for end-to-end flow testing (sessions, wallet, messages, events).
   */
  FAKE_IMAGE_GENERATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type GenerationWorkerConfig = z.infer<typeof configSchema>;

export function loadGenerationConfig(): GenerationWorkerConfig {
  return loadConfig(configSchema);
}
