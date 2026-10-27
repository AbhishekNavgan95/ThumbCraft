# `@platform/rabbitmq-client`

[← Packages](../README.md) · [Root](../../README.md)

Thin `amqplib` wrapper used by auth, wallet, generation, notification, and gateway.

- `connect()` — asserts durable topic exchange `platform.events`
- `publish(routingKey, event)` — persistent JSON, `messageId` = `event.eventId`, `correlationId` set
- `consume(queue, handler, routingKeys)` — asserts queue, binds keys, **acks** on success, **nacks without requeue** on throw

The nack-without-requeue behavior **drops** a failed message unless you add a dead-letter exchange. That is called out in [failure tolerance](../../docs/04-failure-tolerance.md) as work to harden (DLX / outbox). Do not treat the broker as source of truth for chat or balances.

Depends on [`@platform/messaging-contract`](../messaging-contract/README.md).

```bash
pnpm --filter @platform/rabbitmq-client build
```
