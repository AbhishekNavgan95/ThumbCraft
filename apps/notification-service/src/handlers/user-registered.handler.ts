import type { Logger } from "@platform/logger";
import type { PlatformEvent, UserRegisteredPayload } from "@platform/messaging-contract";
import type { MailService } from "../services/mail.service.js";

export async function handleUserRegistered(
  event: PlatformEvent<UserRegisteredPayload>,
  mail: MailService,
  logger: Logger,
): Promise<void> {
  logger.info(
    {
      eventId: event.eventId,
      correlationId: event.correlationId,
      userId: event.userId,
      email: event.payload.email,
    },
    "welcome email requested",
  );

  await mail.sendTemplate(event.payload.email, "welcome", {
    name: event.payload.name,
  });
}
