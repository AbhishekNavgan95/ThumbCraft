import type { Logger } from "@platform/logger";
import {
  Queues,
  RoutingKeys,
  type AuthOtpRequestedPayload,
} from "@platform/messaging-contract";
import type { RabbitMQClient } from "@platform/rabbitmq-client";

export async function startOtpRequestedConsumer(
  rabbitmq: RabbitMQClient,
  logger: Logger,
): Promise<void> {
  await rabbitmq.consume<AuthOtpRequestedPayload>(
    Queues.NOTIFICATION_EVENTS,
    async (event) => {
      logger.info(
        {
          eventId: event.eventId,
          correlationId: event.correlationId,
          userId: event.userId,
          email: event.payload.email,
          name: event.payload.name,
          otp: event.payload.otp,
          expiresAt: event.payload.expiresAt,
        },
        "verify otp email requested",
      );
    },
    [RoutingKeys.AUTH_OTP_REQUESTED],
  );

  logger.info({ queue: Queues.NOTIFICATION_EVENTS }, "otp requested consumer started");
}
