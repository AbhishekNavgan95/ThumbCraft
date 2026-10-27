# `@platform/logger`

[← Packages](../README.md) · [Root](../../README.md)

Pino factory so every process logs with a `service` field and ISO timestamps.

```ts
import { createLogger } from "@platform/logger";

const logger = createLogger({ service: "wallet-service", level: "info" });
logger.info({ jobId }, "reserved coins");
```

Keep secrets and OTP out of `info` logs ([security plan](../../docs/07-security-guardrails-privacy.md)).

```bash
pnpm --filter @platform/logger build
```
