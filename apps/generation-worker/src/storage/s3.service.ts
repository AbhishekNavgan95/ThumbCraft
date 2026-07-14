import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "@platform/errors";
import type { S3Client } from "@aws-sdk/client-s3";
import {
  buildObjectKey,
  contentTypeFromExtension,
  extensionFromContentType,
  parseBase64Input,
} from "./keys.js";
import type {
  ObjectBase64,
  S3StorageConfig,
  UploadBase64Input,
  UploadBufferInput,
  UploadResult,
} from "./types.js";

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);

  // Node.js readable stream from AWS SDK
  const readable = body as AsyncIterable<Uint8Array>;
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class S3StorageService {
  constructor(
    private readonly client: S3Client,
    private readonly config: S3StorageConfig,
  ) {}

  get bucket(): string {
    return this.config.bucket;
  }

  /** Public URL for a stored object (CDN base when configured). */
  getPublicUrl(key: string): string {
    const normalized = key.replace(/^\/+/, "");
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/+$/, "")}/${normalized}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${normalized}`;
  }

  /**
   * Resolve an S3 object key from a full public URL or raw key.
   * Returns null when the URL is not from our bucket / public base.
   */
  extractKeyFromUrl(urlOrKey: string): string | null {
    const value = urlOrKey.trim();
    if (!value) return null;
    if (!/^https?:\/\//i.test(value)) {
      return value.replace(/^\/+/, "");
    }

    try {
      const parsed = new URL(value);
      const pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

      if (this.config.publicBaseUrl) {
        const base = new URL(this.config.publicBaseUrl);
        if (parsed.host === base.host) {
          const basePath = base.pathname.replace(/^\/+|\/+$/g, "");
          if (!basePath) return pathname || null;
          if (pathname.startsWith(`${basePath}/`)) {
            return pathname.slice(basePath.length + 1) || null;
          }
        }
      }

      const virtualHost = `${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;
      const virtualHostLegacy = `${this.config.bucket}.s3.amazonaws.com`;
      if (parsed.host === virtualHost || parsed.host === virtualHostLegacy) {
        return pathname || null;
      }

      // path-style: s3.region.amazonaws.com/bucket/key
      if (
        (parsed.host === `s3.${this.config.region}.amazonaws.com` ||
          parsed.host === "s3.amazonaws.com") &&
        pathname.startsWith(`${this.config.bucket}/`)
      ) {
        return pathname.slice(this.config.bucket.length + 1) || null;
      }
    } catch {
      return null;
    }

    return null;
  }

  private resolveKey(keyOrUrl: string): string {
    const key = this.extractKeyFromUrl(keyOrUrl);
    if (!key) {
      throw new AppError("VALIDATION_ERROR", "Invalid S3 key or URL", 400, {
        keyOrUrl,
      });
    }
    return key;
  }

  async uploadBuffer(input: UploadBufferInput): Promise<UploadResult> {
    if (!input.buffer?.length) {
      throw new AppError("VALIDATION_ERROR", "Empty image buffer", 400);
    }

    const contentType = input.contentType.trim();
    const extension =
      input.extension?.replace(/^\./, "") || extensionFromContentType(contentType);
    const key = buildObjectKey({
      folder: input.folder,
      userId: input.userId,
      sessionId: input.sessionId,
      objectId: input.objectId,
      extension,
    });

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: input.buffer,
          ContentType: contentType,
          Metadata: input.metadata,
        }),
      );
    } catch (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to upload image to S3", 500, {
        key,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      key,
      url: this.getPublicUrl(key),
      bucket: this.config.bucket,
      contentType,
      size: input.buffer.length,
    };
  }

  async uploadBase64(input: UploadBase64Input): Promise<UploadResult> {
    const { buffer, contentType } = parseBase64Input(
      input.data,
      input.contentType ?? "image/png",
    );
    return this.uploadBuffer({
      buffer,
      contentType: input.contentType ?? contentType,
      folder: input.folder,
      userId: input.userId,
      sessionId: input.sessionId,
      objectId: input.objectId,
      extension: input.extension,
      metadata: input.metadata,
    });
  }

  async getObjectBuffer(keyOrUrl: string): Promise<{ buffer: Buffer; contentType: string; key: string }> {
    const key = this.resolveKey(keyOrUrl);
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      const buffer = await streamToBuffer(result.Body);
      const contentType =
        result.ContentType ||
        contentTypeFromExtension(key.split(".").pop() ?? "bin");
      return { buffer, contentType, key };
    } catch (error) {
      throw new AppError("NOT_FOUND", "S3 object not found", 404, {
        key,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Download an object and return base64 for Gemini / OpenAI image parts.
   */
  async getObjectBase64(keyOrUrl: string): Promise<ObjectBase64> {
    const { buffer, contentType, key } = await this.getObjectBuffer(keyOrUrl);
    const data = buffer.toString("base64");
    return {
      data,
      mimeType: contentType,
      dataUri: `data:${contentType};base64,${data}`,
      key,
      size: buffer.length,
    };
  }

  async deleteObject(keyOrUrl: string): Promise<void> {
    const key = this.resolveKey(keyOrUrl);
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to delete S3 object", 500, {
        key,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async exists(keyOrUrl: string): Promise<boolean> {
    const key = this.resolveKey(keyOrUrl);
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Short-lived PUT URL for browser/gateway direct upload (optional path).
   */
  async createPresignedUploadUrl(input: {
    folder: UploadBufferInput["folder"];
    contentType: string;
    userId?: string;
    sessionId?: string;
    objectId?: string;
    extension?: string;
    expiresInSeconds?: number;
  }): Promise<{ key: string; uploadUrl: string; publicUrl: string }> {
    const extension =
      input.extension?.replace(/^\./, "") ||
      extensionFromContentType(input.contentType);
    const key = buildObjectKey({
      folder: input.folder,
      userId: input.userId,
      sessionId: input.sessionId,
      objectId: input.objectId,
      extension,
    });

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: input.contentType,
      }),
      { expiresIn: input.expiresInSeconds ?? 900 },
    );

    return {
      key,
      uploadUrl,
      publicUrl: this.getPublicUrl(key),
    };
  }

  /**
   * Short-lived GET URL when the bucket is private and CDN is not used.
   */
  async createPresignedDownloadUrl(
    keyOrUrl: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const key = this.resolveKey(keyOrUrl);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds },
    );
  }
}
