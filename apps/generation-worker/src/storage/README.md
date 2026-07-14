# S3 storage module

`src/storage` — shared image I/O for references, generated results, and templates.

## Setup

Env (see `.env.example`):

```
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=        # optional with IAM role
AWS_SECRET_ACCESS_KEY=
AWS_S3_PUBLIC_BASE_URL=   # optional CDN base, no trailing slash
```

```ts
import { loadGenerationConfig } from "../config.js";
import { createS3StorageFromEnv } from "./index.js";

const storage = createS3StorageFromEnv(loadGenerationConfig());
```

## Key layout

```
references/{userId}/{sessionId}/{id}.{ext}
generated/{userId}/{sessionId}/{messageId}.{ext}
templates/{…}/{id}.{ext}
```

## API

| Method | Use |
|--------|-----|
| `uploadBuffer` | Worker result / gateway buffer → `{ key, url }` |
| `uploadBase64` | Model output base64 / data-URI → public URL |
| `getObjectBuffer` | Read bytes by key or URL |
| `getObjectBase64` | Gemini/OpenAI image part (`data`, `mimeType`, `dataUri`) |
| `getPublicUrl` | Build client-facing URL |
| `extractKeyFromUrl` | URL → key (our bucket / CDN only) |
| `deleteObject` | Remove object |
| `exists` | HeadObject check |
| `createPresignedUploadUrl` | Direct browser/gateway PUT |
| `createPresignedDownloadUrl` | Temporary GET for private buckets |

## Flow examples

Upload generated thumbnail:

```ts
const { url, key } = await storage.uploadBuffer({
  buffer,
  contentType: "image/png",
  folder: "generated",
  userId,
  sessionId,
  objectId: assistantMessageId,
});
```

Pass reference image into a model:

```ts
const { data, mimeType } = await storage.getObjectBase64(referenceImageUrl);
// Gemini: { type: "image", mime_type: mimeType, data }
```
