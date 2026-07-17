export interface ImageGenerateRequest {
  model: string;
  input: string;
  aspectRatio: string;
  resolution: string;
  mimeType?: string;
  /** Gemini Interactions continuation. */
  previousInteractionId?: string | null;
  /** Reference image URLs or base64 payloads for image-to-image / edit. */
  referenceImages?: Array<{
    url?: string;
    base64?: string;
    mimeType?: string;
  }>;
}

export interface GeneratedImagePayload {
  buffer: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface ImageGenerateResult {
  interactionId?: string;
  images: GeneratedImagePayload[];
  raw?: unknown;
}

export interface ImageProvider {
  readonly name: "gemini" | "openai";
  generate(request: ImageGenerateRequest): Promise<ImageGenerateResult>;
}
