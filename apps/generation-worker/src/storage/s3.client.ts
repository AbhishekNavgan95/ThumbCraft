import { S3Client } from "@aws-sdk/client-s3";
import type { S3StorageConfig } from "./types.js";

export function createS3Client(config: S3StorageConfig): S3Client {
  const credentials =
    config.accessKeyId && config.secretAccessKey
      ? {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        }
      : undefined;

  return new S3Client({
    region: config.region,
    credentials,
  });
}
