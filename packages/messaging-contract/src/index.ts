/** RabbitMQ exchange for all platform events. */
export const PLATFORM_EXCHANGE = "platform.events" as const;

/** Routing key format: `{domain}.{action}` */
export const RoutingKeys = {
  USER_REGISTERED: "user.registered",
  AUTH_OTP_REQUESTED: "auth.otp_requested",
  GENERATION_REQUESTED: "generation.requested",
  GENERATION_COMPLETED: "generation.completed",
  GENERATION_FAILED: "generation.failed",
  WALLET_PURCHASE_COMPLETED: "wallet.purchase_completed",
  WALLET_PURCHASE_FAILED: "wallet.purchase_failed",
} as const;

export type RoutingKey = (typeof RoutingKeys)[keyof typeof RoutingKeys];

/** Base envelope included on every published event. */
export interface PlatformEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  correlationId: string;
  timestamp: string;
  userId: string;
  jobId?: string;
  payload: TPayload;
}

export interface UserRegisteredPayload {
  email: string;
  name: string;
}

export interface AuthOtpRequestedPayload {
  email: string;
  name: string;
  otp: string;
  expiresAt: string;
}

export interface GenerationRequestedPayload {
  modelId: string;
  type: "text-to-image" | "image-to-image";
  prompt: string;
  filters: Record<string, unknown>;
  inputImageUrl?: string;
  enhancePrompt: boolean;
  coinCost: number;
}

export type GenerationJobKindPayload = "generation" | "prompt_enhance";

export interface GenerationCompletedPayload {
  kind: GenerationJobKindPayload;
  /** Present for image generation jobs. */
  imageUrls?: string[];
  /** Present for prompt_enhance jobs. */
  enhancedPrompt?: string;
}

export interface GenerationFailedPayload {
  kind: GenerationJobKindPayload;
  error: string;
}

export interface WalletPurchaseCompletedPayload {
  email: string;
  name: string;
  coins: number;
  packageName: string;
  stripePaymentId: string;
}

export interface WalletPurchaseFailedPayload {
  email: string;
  name: string;
  coins: number;
  packageName: string;
  reason: string;
}

export const Queues = {
  WALLET_EVENTS: "wallet.events",
  GENERATION_WORKER: "generation.worker",
  NOTIFICATION_EVENTS: "notification.events",
} as const;

export type QueueName = (typeof Queues)[keyof typeof Queues];
