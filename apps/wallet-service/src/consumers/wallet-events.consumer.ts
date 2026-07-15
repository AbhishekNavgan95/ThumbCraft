import type { Logger } from "@platform/logger";
import {
  Queues,
  RoutingKeys,
  type GenerationCompletedPayload,
  type GenerationFailedPayload,
  type PlatformEvent,
  type UserRegisteredPayload,
} from "@platform/messaging-contract";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import type { PrismaClient } from "../generated/prisma/client.js";
import {
  handleGenerationCompleted,
  handleGenerationFailed,
} from "../handlers/generation-billing.handler.js";
import { handleUserRegistered } from "../handlers/user-registered.handler.js";

const WALLET_ROUTING_KEYS = [
  RoutingKeys.USER_REGISTERED,
  RoutingKeys.GENERATION_COMPLETED,
  RoutingKeys.GENERATION_FAILED,
] as const;

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
        case RoutingKeys.GENERATION_COMPLETED:
          await handleGenerationCompleted(
            event as PlatformEvent<GenerationCompletedPayload>,
            prisma,
            logger,
          );
          break;
        case RoutingKeys.GENERATION_FAILED:
          await handleGenerationFailed(
            event as PlatformEvent<GenerationFailedPayload>,
            prisma,
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
