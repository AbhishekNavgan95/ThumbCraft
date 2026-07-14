import { AppError } from "@platform/errors";
import type { S3StorageService } from "../../storage/index.js";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface ReferenceUploadInput {
  buffer: Buffer;
  contentType: string;
  filename?: string;
  userId: string;
  sessionId?: string;
}

export interface ReferenceUploadResult {
  url: string;
  key: string;
  contentType: string;
  size: number;
  /** Echoed for clients that attach this URL on the next generate/refine call. */
  folder: "references";
}

export class UploadService {
  constructor(private readonly storage: S3StorageService) {}

  async uploadReferenceImage(
    input: ReferenceUploadInput,
  ): Promise<ReferenceUploadResult> {
    const contentType = input.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_MIME.has(contentType)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Only JPEG, PNG, WebP, or GIF images are allowed",
        400,
        { contentType },
      );
    }

    if (!input.buffer.length) {
      throw new AppError("VALIDATION_ERROR", "Empty image file", 400);
    }

    if (input.buffer.byteLength > MAX_FILE_SIZE) {
      throw new AppError(
        "VALIDATION_ERROR",
        "File too large. Maximum size is 10MB",
        400,
        { size: input.buffer.byteLength },
      );
    }

    const uploaded = await this.storage.uploadBuffer({
      buffer: input.buffer,
      contentType,
      folder: "references",
      userId: input.userId,
      sessionId: input.sessionId,
      metadata: input.filename
        ? { original_filename: sanitizeMetadata(input.filename) }
        : undefined,
    });

    return {
      url: uploaded.url,
      key: uploaded.key,
      contentType: uploaded.contentType,
      size: uploaded.size,
      folder: "references",
    };
  }
}

function sanitizeMetadata(value: string): string {
  return value.replace(/[^\w.\-]+/g, "_").slice(0, 180);
}

export { MAX_FILE_SIZE, ALLOWED_MIME };
