# Shared packages

Libraries consumed by every Node service. They are **not** deployable on their own. Turbo builds them before app `dev` / `test` / `typecheck` (`dependsOn: ["^build"]` in [`turbo.json`](../turbo.json)).

Import names use the `@platform/*` scope.

| Package | npm name | README |
|---------|----------|--------|
| Env + Zod | `@platform/config` | [config](./config/README.md) |
| Typed HTTP errors | `@platform/errors` | [errors](./errors/README.md) |
| Structured logs | `@platform/logger` | [logger](./logger/README.md) |
| Event schemas | `@platform/messaging-contract` | [messaging-contract](./messaging-contract/README.md) |
| AMQP client | `@platform/rabbitmq-client` | [rabbitmq-client](./rabbitmq-client/README.md) |

Back to the [root README](../README.md).
