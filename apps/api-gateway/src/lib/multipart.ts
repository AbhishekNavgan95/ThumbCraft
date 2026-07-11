import type { FastifyRequest } from "fastify";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function buildMultipartBody(
  request: FastifyRequest,
): Promise<FormData> {
  const form = new FormData();

  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (!part.mimetype.startsWith("image/")) {
        throw new Error("Only image files are allowed!");
      }

      const buffer = await part.toBuffer();
      if (buffer.byteLength > MAX_FILE_SIZE) {
        throw new Error("File too large. Maximum size is 10MB.");
      }

      const blob = new Blob([buffer], { type: part.mimetype });
      form.append(part.fieldname, blob, part.filename);
      continue;
    }

    form.append(part.fieldname, part.value);
  }

  return form;
}
