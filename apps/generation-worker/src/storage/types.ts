export type ImageFolder = "references" | "generated" | "templates";

export interface S3StorageConfig {
  region: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** CDN or public bucket base, no trailing slash. */
  publicBaseUrl?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  contentType: string;
  size: number;
}

export interface ObjectBase64 {
  /** Raw base64 payload (no data: prefix). */
  data: string;
  mimeType: string;
  /** Full data-URI if a consumer needs it. */
  dataUri: string;
  key: string;
  size: number;
}

export interface UploadBufferInput {
  buffer: Buffer;
  contentType: string;
  /** Logical folder prefix. */
  folder: ImageFolder;
  userId?: string;
  sessionId?: string;
  /** Optional stable id (e.g. messageId) used in the object key. */
  objectId?: string;
  /** File extension without dot; inferred from contentType when omitted. */
  extension?: string;
  metadata?: Record<string, string>;
}

export interface UploadBase64Input {
  /** Raw base64 or data-URI (`data:image/png;base64,...`). */
  data: string;
  contentType?: string;
  folder: ImageFolder;
  userId?: string;
  sessionId?: string;
  objectId?: string;
  extension?: string;
  metadata?: Record<string, string>;
}

export interface BuildKeyInput {
  folder: ImageFolder;
  userId?: string;
  sessionId?: string;
  objectId?: string;
  extension: string;
}
