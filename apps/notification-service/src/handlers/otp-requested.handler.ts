import type { Logger } from "@platform/logger";
import type { AuthOtpRequestedPayload, PlatformEvent } from "@platform/messaging-contract";
import type { MailService } from "../services/mail.service.js";

export async function handleOtpRequested(
  event: PlatformEvent<AuthOtpRequestedPayload>,
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
    "otp verification email requested",
  );

  await mail.sendTemplate(event.payload.email, "otp-verification", {
    name: event.payload.name,
    otp: event.payload.otp,
    expiresAt: event.payload.expiresAt,
  });
}
