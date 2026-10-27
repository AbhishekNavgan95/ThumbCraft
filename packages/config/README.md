# `@platform/config`

[← Packages](../README.md) · [Root](../../README.md)

Zod-backed environment loading shared by every Node app.

- `loadConfig(schema)` — `safeParse` `process.env` (after `dotenv`); throws a flattened field-error JSON on failure.
- `baseServiceSchema` — `NODE_ENV`, `PORT`, `LOG_LEVEL`.
- Re-exports `z` so services do not take a second Zod version for env files.

Each app extends the base schema (URLs, secrets, feature flags) in its own `src/config.ts`.

```bash
pnpm --filter @platform/config build
```
