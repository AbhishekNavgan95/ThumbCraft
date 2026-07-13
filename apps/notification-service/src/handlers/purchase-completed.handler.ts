import type { Logger } from "@platform/logger";
import type {
  PlatformEvent,
  WalletPurchaseCompletedPayload,
} from "@platform/messaging-contract";
import type { MailService } from "../services/mail.service.js";

export async function handlePurchaseCompleted(
  event: PlatformEvent<WalletPurchaseCompletedPayload>,
  mail: MailService,
  logger: Logger,
): Promise<void> {
  logger.info(
    {
      eventId: event.eventId,
      correlationId: event.correlationId,
      userId: event.userId,
      email: event.payload.email,
      coins: event.payload.coins,
    },
    "purchase receipt email requested",
  );

  await mail.sendTemplate(event.payload.email, "purchase-completed", {
    name: event.payload.name,
    coins: event.payload.coins,
    packageName: event.payload.packageName,
    stripePaymentId: event.payload.stripePaymentId,
  });
}
