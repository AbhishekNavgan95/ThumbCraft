import { AppError } from "@platform/errors";
import type { FastifyRequest } from "fastify";
import { requireGatewayUserId } from "../../lib/gateway-user.js";
import { MAX_FILE_SIZE, type UploadService } from "./upload.service.js";

const FILE_FIELDS = new Set(["image", "file", "reference"]);

/**
 * Accepts multipart forwarded by API Gateway (FormData proxy).
 * Field `image` (or `file` / `reference`) + optional `sessionId`.
 */
export async function uploadReferenceController(
  request: FastifyRequest,
  uploadService: UploadService,
) {
  const userId = requireGatewayUserId(request);

  let fileBuffer: Buffer | null = null;
  let contentType = "";
  let filename: string | undefined;
  let sessionId: string | undefined;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (!FILE_FIELDS.has(part.fieldname)) {
        await part.toBuffer();
        continue;
      }

      fileBuffer = await part.toBuffer();
      contentType = part.mimetype;
      filename = part.filename;
      continue;
    }

    if (part.fieldname === "sessionId" && typeof part.value === "string") {
      const value = part.value.trim();
      sessionId = value.length > 0 ? value : undefined;
    }
  }

  if (!fileBuffer) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Missing image file. Use multipart field name: image",
      400,
    );
  }

  if (fileBuffer.byteLength > MAX_FILE_SIZE) {
    throw new AppError(
      "VALIDATION_ERROR",
      "File too large. Maximum size is 10MB",
      400,
    );
  }

  const result = await uploadService.uploadReferenceImage({
    buffer: fileBuffer,
    contentType,
    filename,
    userId,
    sessionId,
  });

  return {
    url: result.url,
    key: result.key,
    contentType: result.contentType,
    size: result.size,
    folder: result.folder,
  };
}
