import type { Logger } from "@platform/logger";
import {
  Queues,
  RoutingKeys,
  type PlatformEvent,
  type UserRegisteredPayload,
} from "@platform/messaging-contract";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import type { PrismaClient } from "../generated/prisma/client.js";
import { handleUserRegistered } from "../handlers/user-registered.handler.js";

const WALLET_ROUTING_KEYS = [RoutingKeys.USER_REGISTERED] as const;

export async function startWalletEventsConsumer(
  rabbitmq: RabbitMQClient,
  prisma: PrismaClient,
  welcomeBonusCoins: number,
  logger: Logger,
): Promise<void> {
  await rabbitmq.consume(
    Queues.WALLET_EVENTS,
    async (event, routingKey) => {
      switch (routingKey) {
        case RoutingKeys.USER_REGISTERED:
          await handleUserRegistered(
            event as PlatformEvent<UserRegisteredPayload>,
            prisma,
            welcomeBonusCoins,
            logger,
          );
          break;
        default:
          logger.warn({ routingKey, eventId: event.eventId }, "unhandled wallet event");
      }
    },
    [...WALLET_ROUTING_KEYS],
  );

  logger.info(
    { queue: Queues.WALLET_EVENTS, routingKeys: WALLET_ROUTING_KEYS },
    "wallet events consumer started",
  );
}
