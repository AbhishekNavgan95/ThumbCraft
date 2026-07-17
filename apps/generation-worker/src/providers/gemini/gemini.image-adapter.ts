import type { GoogleGenAI } from "@google/genai";
import { AppError } from "@platform/errors";
import type {
  ImageGenerateRequest,
  ImageGenerateResult,
  ImageProvider,
} from "../types.js";

type InteractionInputPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string }
  | { type: "image"; uri: string; mime_type: string };

/**
 * Gemini Interactions image adapter.
 * Uses response_format with snake_case wire keys for the live API.
 */
export class GeminiImageAdapter implements ImageProvider {
  readonly name = "gemini" as const;

  constructor(private readonly client: GoogleGenAI) {}

  async generate(request: ImageGenerateRequest): Promise<ImageGenerateResult> {
    try {
      const mimeType = request.mimeType ?? "image/jpeg";
      const input = buildInteractionInput(request);

      // Prefer snake_case fields for Interactions API compatibility.
      const interaction = await this.client.interactions.create({
        model: request.model,
        input,
        ...(request.previousInteractionId
          ? { previous_interaction_id: request.previousInteractionId }
          : {}),
        response_format: {
          type: "image",
          mime_type: mimeType,
          aspect_ratio: request.aspectRatio,
          image_size: request.resolution,
        },
      } as never);

      const images = extractImages(interaction);
      if (images.length === 0) {
        throw new AppError(
          "INTERNAL_ERROR",
          "Gemini returned no image data",
          502,
        );
      }

      const interactionId =
        typeof (interaction as { id?: unknown }).id === "string"
          ? (interaction as { id: string }).id
          : undefined;

      return {
        interactionId,
        images,
        raw: interaction,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      const message =
        error instanceof Error ? error.message : "Gemini image generation failed";
      throw new AppError("INTERNAL_ERROR", message, 502);
    }
  }
}

/**
 * Text-only when there are no refs; multimodal array when refs are present
 * so Gemini can do text-and-image-to-image editing.
 */
function buildInteractionInput(
  request: ImageGenerateRequest,
): string | InteractionInputPart[] {
  const refs = request.referenceImages ?? [];
  if (refs.length === 0) {
    return request.input;
  }

  const parts: InteractionInputPart[] = [
    { type: "text", text: request.input },
  ];

  for (const ref of refs) {
    const imageMime = ref.mimeType?.trim() || "image/png";
    if (ref.base64?.trim()) {
      parts.push({
        type: "image",
        data: ref.base64.trim(),
        mime_type: imageMime,
      });
      continue;
    }
    if (ref.url?.trim()) {
      // Public HTTPS URLs Gemini can fetch directly.
      parts.push({
        type: "image",
        uri: ref.url.trim(),
        mime_type: imageMime,
      });
      continue;
    }
    throw new AppError(
      "VALIDATION_ERROR",
      "Reference image is missing base64 data and url",
      400,
    );
  }

  return parts;
}

function extractImages(interaction: unknown): ImageGenerateResult["images"] {
  const images: ImageGenerateResult["images"] = [];

  // Convenience property on some SDK versions
  const convenience = (interaction as { output_image?: unknown }).output_image;
  if (convenience) {
    const parsed = parseImageBlock(convenience);
    if (parsed) images.push(parsed);
  }

  const outputs = (interaction as { outputs?: unknown }).outputs;
  if (Array.isArray(outputs)) {
    for (const block of outputs) {
      const parsed = parseImageBlock(block);
      if (parsed) images.push(parsed);
    }
  }

  // Deduplicate by buffer length + first bytes signature
  const seen = new Set<string>();
  return images.filter((img) => {
    const key = `${img.mimeType}:${img.buffer.length}:${img.buffer.subarray(0, 16).toString("hex")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseImageBlock(
  block: unknown,
): ImageGenerateResult["images"][number] | null {
  if (!block || typeof block !== "object") return null;
  const obj = block as Record<string, unknown>;

  const mimeType =
    (typeof obj.mime_type === "string" && obj.mime_type) ||
    (typeof obj.mimeType === "string" && obj.mimeType) ||
    "image/jpeg";

  const data =
    (typeof obj.data === "string" && obj.data) ||
    (typeof obj.b64_json === "string" && obj.b64_json) ||
    (typeof obj.base64 === "string" && obj.base64) ||
    null;

  if (data) {
    return {
      buffer: Buffer.from(data, "base64"),
      mimeType,
    };
  }

  // Nested image content shapes
  const image = obj.image;
  if (image && typeof image === "object") {
    return parseImageBlock(image);
  }

  return null;
}
