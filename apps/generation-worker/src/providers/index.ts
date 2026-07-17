import { AppError } from "@platform/errors";
import type { Provider } from "../generated/prisma/client.js";
import { createGeminiClient } from "./gemini/gemini.client.js";
import { GeminiImageAdapter } from "./gemini/gemini.image-adapter.js";
import { OpenAIImageAdapter } from "./openai/openai.image-adapter.js";
import type { ImageProvider } from "./types.js";

export type { ImageGenerateRequest, ImageGenerateResult, ImageProvider } from "./types.js";

export function createImageProvider(
  provider: Provider,
  keys: { geminiApiKey?: string; openaiApiKey?: string },
): ImageProvider {
  if (provider === "gemini") {
    if (!keys.geminiApiKey?.trim()) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "GEMINI_API_KEY is not configured",
        503,
      );
    }
    return new GeminiImageAdapter(createGeminiClient(keys.geminiApiKey));
  }

  if (provider === "openai") {
    return new OpenAIImageAdapter();
  }

  throw new AppError(
    "VALIDATION_ERROR",
    `Unsupported provider: ${provider}`,
    422,
  );
}
