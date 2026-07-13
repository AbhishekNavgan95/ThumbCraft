import type { Logger } from "@platform/logger";
import {
  Queues,
  RoutingKeys,
  type AuthOtpRequestedPayload,
  type PlatformEvent,
  type UserRegisteredPayload,
  type WalletPurchaseCompletedPayload,
  type WalletPurchaseFailedPayload,
} from "@platform/messaging-contract";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import { handleOtpRequested } from "../handlers/otp-requested.handler.js";
import { handlePurchaseCompleted } from "../handlers/purchase-completed.handler.js";
import { handlePurchaseFailed } from "../handlers/purchase-failed.handler.js";
import { handleUserRegistered } from "../handlers/user-registered.handler.js";
import type { MailService } from "../services/mail.service.js";

const NOTIFICATION_ROUTING_KEYS = [
  RoutingKeys.AUTH_OTP_REQUESTED,
  RoutingKeys.USER_REGISTERED,
  RoutingKeys.WALLET_PURCHASE_COMPLETED,
  RoutingKeys.WALLET_PURCHASE_FAILED,
] as const;

export async function startNotificationEventsConsumer(
  rabbitmq: RabbitMQClient,
  mail: MailService,
  logger: Logger,
): Promise<void> {
  await rabbitmq.consume(
    Queues.NOTIFICATION_EVENTS,
    async (event, routingKey) => {
      switch (routingKey) {
        case RoutingKeys.AUTH_OTP_REQUESTED:
          await handleOtpRequested(
            event as PlatformEvent<AuthOtpRequestedPayload>,
            mail,
            logger,
          );
          break;
        case RoutingKeys.USER_REGISTERED:
          await handleUserRegistered(
            event as PlatformEvent<UserRegisteredPayload>,
            mail,
            logger,
          );
          break;
        case RoutingKeys.WALLET_PURCHASE_COMPLETED:
          await handlePurchaseCompleted(
            event as PlatformEvent<WalletPurchaseCompletedPayload>,
            mail,
            logger,
          );
          break;
        case RoutingKeys.WALLET_PURCHASE_FAILED:
          await handlePurchaseFailed(
            event as PlatformEvent<WalletPurchaseFailedPayload>,
            mail,
            logger,
          );
          break;
        default:
          logger.warn({ routingKey, eventId: event.eventId }, "unhandled notification event");
      }
    },
    [...NOTIFICATION_ROUTING_KEYS],
  );

  logger.info(
    { queue: Queues.NOTIFICATION_EVENTS, routingKeys: NOTIFICATION_ROUTING_KEYS },
    "notification events consumer started",
  );
}
