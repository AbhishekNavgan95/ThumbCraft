import { AppError } from "@platform/errors";
import type { FastifyRequest } from "fastify";
import { requireGatewayUserId } from "../../lib/gateway-user.js";
import { MAX_FILE_SIZE, type UploadService } from "./upload.service.js";

const REFERENCE_FILE_FIELDS = new Set(["image", "file", "reference"]);
const TEMPLATE_FILE_FIELDS = new Set(["image", "file", "template"]);

/**
 * Accepts multipart forwarded by API Gateway (FormData proxy).
 * Field `image` (or `file` / `reference`) + optional `sessionId`.
 */
export async function uploadReferenceController(
  request: FastifyRequest,
  uploadService: UploadService,
) {
  const userId = requireGatewayUserId(request);
  const parsed = await parseMultipartImage(request, REFERENCE_FILE_FIELDS, {
    allowSessionId: true,
  });

  const result = await uploadService.uploadReferenceImage({
    buffer: parsed.fileBuffer,
    contentType: parsed.contentType,
    filename: parsed.filename,
    userId,
    sessionId: parsed.sessionId,
  });

  return {
    url: result.url,
    key: result.key,
    contentType: result.contentType,
    size: result.size,
    folder: result.folder,
  };
}

/**
 * Admin gallery image upload. Caller must run requireAdmin first.
 * Field `image` (or `file` / `template`).
 */
export async function uploadTemplateController(
  request: FastifyRequest,
  uploadService: UploadService,
) {
  const userId = request.user!.id;
  const parsed = await parseMultipartImage(request, TEMPLATE_FILE_FIELDS);

  const result = await uploadService.uploadTemplateImage({
    buffer: parsed.fileBuffer,
    contentType: parsed.contentType,
    filename: parsed.filename,
    userId,
  });

  return {
    url: result.url,
    key: result.key,
    contentType: result.contentType,
    size: result.size,
    folder: result.folder,
  };
}

async function parseMultipartImage(
  request: FastifyRequest,
  fileFields: Set<string>,
  options: { allowSessionId?: boolean } = {},
): Promise<{
  fileBuffer: Buffer;
  contentType: string;
  filename?: string;
  sessionId?: string;
}> {
  let fileBuffer: Buffer | null = null;
  let contentType = "";
  let filename: string | undefined;
  let sessionId: string | undefined;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (!fileFields.has(part.fieldname)) {
        await part.toBuffer();
        continue;
      }

      fileBuffer = await part.toBuffer();
      contentType = part.mimetype;
      filename = part.filename;
      continue;
    }

    if (
      options.allowSessionId &&
      part.fieldname === "sessionId" &&
      typeof part.value === "string"
    ) {
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

  return { fileBuffer, contentType, filename, sessionId };
}
