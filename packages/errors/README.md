# `@platform/errors`

[← Packages](../README.md) · [Root](../../README.md)

Typed errors for HTTP mapping in Fastify error handlers.

- `AppError(code, message, statusCode, details?)`
- `ErrorCode`: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INSUFFICIENT_FUNDS`, `CONFLICT`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`
- `isAppError()` for `instanceof`-safe checks across packages

Gateway and services serialize these to `{ code, message, details }` so the SPA can show 402 vs 401 vs 503 distinctly.

```bash
pnpm --filter @platform/errors build
```
