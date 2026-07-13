import type { Logger } from "@platform/logger";
import type {
  PlatformEvent,
  WalletPurchaseFailedPayload,
} from "@platform/messaging-contract";
import type { MailService } from "../services/mail.service.js";

export async function handlePurchaseFailed(
  event: PlatformEvent<WalletPurchaseFailedPayload>,
  mail: MailService,
  logger: Logger,
): Promise<void> {
  logger.info(
    {
      eventId: event.eventId,
      correlationId: event.correlationId,
      userId: event.userId,
      email: event.payload.email,
      reason: event.payload.reason,
    },
    "purchase failure email requested",
  );

  await mail.sendTemplate(event.payload.email, "purchase-failed", {
    name: event.payload.name,
    coins: event.payload.coins,
    packageName: event.payload.packageName,
    reason: event.payload.reason,
  });
}
