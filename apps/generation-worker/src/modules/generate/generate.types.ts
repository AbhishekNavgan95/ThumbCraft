import type { ThumbnailPreferences } from "../../prompts/types.js";

export interface GenerateRequestBody {
  sessionId?: string;
  originalPrompt: string;
  enhancedPrompt?: string | null;
  usedEnhancedPrompt?: boolean;
  preferences?: ThumbnailPreferences;
  modelId: string;
  requiredAspectRatio: string;
  requiredResolution: string;
  referenceImageUrls?: string[];
  referenceTemplateIds?: string[];
}

export interface GenerateResult {
  session: {
    id: string;
    latestInteractionId: string | null;
    latestMessageId: string | null;
    latestAssistantMessageId: string | null;
  };
  userMessage: ReturnType<
    typeof import("../messages/message.service.js").toPublicMessage
  >;
  assistantMessage: ReturnType<
    typeof import("../messages/message.service.js").toPublicMessage
  >;
  job: {
    id: string;
    status: string;
    coinCost: number;
    /** Coins reserved synchronously; capture/release via wallet on RabbitMQ events. */
    billing: "reserved_then_capture_via_event" | "released";
  };
  providerInput: string;
  isFirstTurn: boolean;
}
