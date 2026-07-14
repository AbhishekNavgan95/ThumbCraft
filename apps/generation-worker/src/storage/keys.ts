import { randomUUID } from "node:crypto";
import type { BuildKeyInput } from "./types.js";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export function extensionFromContentType(contentType: string): string {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return EXT_BY_MIME[normalized] ?? "bin";
}

export function contentTypeFromExtension(extension: string): string {
  const ext = extension.replace(/^\./, "").toLowerCase();
  const match = Object.entries(EXT_BY_MIME).find(([, value]) => value === ext);
  return match?.[0] ?? "application/octet-stream";
}

/**
 * Build a stable object key:
 *   {folder}/{userId?}/{sessionId?}/{objectId|uuid}.{ext}
 */
export function buildObjectKey(input: BuildKeyInput): string {
  const parts: string[] = [input.folder];
  if (input.userId) parts.push(input.userId);
  if (input.sessionId) parts.push(input.sessionId);
  const id = input.objectId?.trim() || randomUUID();
  const ext = input.extension.replace(/^\./, "").toLowerCase();
  parts.push(`${id}.${ext}`);
  return parts.join("/");
}

/** Parse raw base64 or data-URI into buffer + mime. */
export function parseBase64Input(
  data: string,
  fallbackContentType = "image/png",
): { buffer: Buffer; contentType: string } {
  const trimmed = data.trim();
  const dataUriMatch = /^data:([^;]+);base64,(.+)$/s.exec(trimmed);
  if (dataUriMatch) {
    return {
      contentType: dataUriMatch[1]!.trim(),
      buffer: Buffer.from(dataUriMatch[2]!, "base64"),
    };
  }
  return {
    contentType: fallbackContentType,
    buffer: Buffer.from(trimmed, "base64"),
  };
}
