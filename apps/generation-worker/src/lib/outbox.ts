import type { Logger } from "@platform/logger";
import type {
  PlatformEvent,
  RoutingKey,
} from "@platform/messaging-contract";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import type { PrismaClient } from "../generated/prisma/client.js";

const BATCH_SIZE = 50;
const WARN_AFTER_ATTEMPTS = 20;

export interface OutboxDeps {
  prisma: PrismaClient;
  rabbitmq: RabbitMQClient;
  logger: Logger;
}

export interface RelayResult {
  published: number;
  failed: number;
}

/**
 * Publish pending terminal events and stamp `publishedAt`.
 *
 * Delivery is at-least-once. A publish failure leaves the row pending and
 * records the error so the next tick retries it. Wallet consumers dedupe on
 * `capture:{jobId}` / `release:{jobId}`, so a duplicate publish is harmless.
 */
export async function relayOutbox(deps: OutboxDeps): Promise<RelayResult> {
  const pending = await deps.prisma.generationOutbox.findMany({
    where: { publishedAt: null },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  let published = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      await deps.rabbitmq.publish(
        row.routingKey as RoutingKey,
        row.payload as unknown as PlatformEvent<unknown>,
      );
      await deps.prisma.generationOutbox.update({
        where: { id: row.id },
        data: { publishedAt: new Date(), lastError: null },
      });
      published += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = row.attempts + 1;

      await deps.prisma.generationOutbox.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          lastError: message,
        },
      });

      failed += 1;

      if (attempts >= WARN_AFTER_ATTEMPTS) {
        deps.logger.warn(
          { outboxId: row.id, jobId: row.jobId, attempts, err: error },
          "generation outbox event is repeatedly failing to publish",
        );
      }
    }
  }

  return { published, failed };
}

/**
 * Run the relay once immediately, then on an interval. Intended to live in the
 * worker process; the interval is unref'd so it never keeps a shutting-down
 * process alive.
 */
export function startOutboxRelay(
  deps: OutboxDeps & { intervalMs: number },
): { stop: () => void; relay: () => Promise<RelayResult> } {
  let stopped = false;
  let running = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await relayOutbox(deps);
    } catch (error) {
      deps.logger.error({ err: error }, "generation outbox relay tick failed");
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), deps.intervalMs);
  timer.unref?.();

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    relay() {
      return relayOutbox(deps);
    },
  };
}
