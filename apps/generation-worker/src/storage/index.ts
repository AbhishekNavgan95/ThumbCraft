import type { GenerationWorkerConfig } from "../config.js";
import { createS3Client } from "./s3.client.js";
import { S3StorageService } from "./s3.service.js";
import type { S3StorageConfig } from "./types.js";

export type {
  BuildKeyInput,
  ImageFolder,
  ObjectBase64,
  S3StorageConfig,
  UploadBase64Input,
  UploadBufferInput,
  UploadResult,
} from "./types.js";
export {
  buildObjectKey,
  contentTypeFromExtension,
  extensionFromContentType,
  parseBase64Input,
} from "./keys.js";
export { createS3Client } from "./s3.client.js";
export { S3StorageService } from "./s3.service.js";

export function createS3Storage(config: S3StorageConfig): S3StorageService {
  if (!config.bucket) {
    throw new Error("AWS_S3_BUCKET is required to create S3 storage");
  }
  const client = createS3Client(config);
  return new S3StorageService(client, config);
}

export function createS3StorageFromEnv(
  config: GenerationWorkerConfig,
): S3StorageService {
  if (!config.AWS_S3_BUCKET) {
    throw new Error("AWS_S3_BUCKET is required to create S3 storage");
  }

  return createS3Storage({
    region: config.AWS_REGION,
    bucket: config.AWS_S3_BUCKET,
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    publicBaseUrl: config.AWS_S3_PUBLIC_BASE_URL,
  });
}
