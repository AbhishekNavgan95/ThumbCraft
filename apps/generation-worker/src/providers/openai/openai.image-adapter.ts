import { AppError } from "@platform/errors";
import type {
  ImageGenerateRequest,
  ImageGenerateResult,
  ImageProvider,
} from "../types.js";

/**
 * OpenAI image generation adapter — placeholder until wired.
 * Enhance-only OpenAI client remains under providers/openai/prompt-enhancer.
 */
export class OpenAIImageAdapter implements ImageProvider {
  readonly name = "openai" as const;

  async generate(_request: ImageGenerateRequest): Promise<ImageGenerateResult> {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "OpenAI image generation is not implemented yet. Select a Gemini model.",
      501,
    );
  }
}
