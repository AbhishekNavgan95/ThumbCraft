# `@platform/messaging-contract`

[← Packages](../README.md) · [Root](../../README.md)

**Single source of truth** for RabbitMQ topology names and TypeScript payloads. Publishers and consumers import this package instead of stringly-typed routing keys.

## Exchange and queues

- Exchange: `platform.events` (topic, durable)
- Routing keys: `{domain}.{action}` via `RoutingKeys`
- Queues: `Queues.WALLET_EVENTS`, `GENERATION_WORKER` (reserved name; image work uses BullMQ), `NOTIFICATION_EVENTS`

## Envelope

Every message is a `PlatformEvent<T>`:

| Field | Meaning |
|-------|---------|
| `eventId` | Idempotency / message id |
| `correlationId` | Request trace (gateway `X-Correlation-Id`) |
| `timestamp` | ISO time |
| `userId` | Subject user |
| `jobId` | Optional; billing uses generation job UUID |
| `payload` | Domain body |

## Routing keys

| Key | Typical publisher | Typical consumers |
|-----|-------------------|-------------------|
| `user.registered` | auth | wallet, notification |
| `auth.otp_requested` | auth | notification |
| `generation.requested` | (contract; generate is HTTP + BullMQ) | — |
| `generation.completed` | generation-worker | wallet, notification |
| `generation.failed` | generation-worker | wallet, notification |
| `wallet.purchase_completed` | wallet | notification |
| `wallet.purchase_failed` | wallet | notification |

Payload interfaces live next to the keys in [`src/index.ts`](./src/index.ts).

```bash
pnpm --filter @platform/messaging-contract build
```
