import type { Logger } from "@platform/logger";
import type {
  GenerationFailedPayload,
  PlatformEvent,
} from "@platform/messaging-contract";
import type { MailService } from "../services/mail.service.js";

export async function handleGenerationFailed(
  event: PlatformEvent<GenerationFailedPayload>,
  mail: MailService,
  logger: Logger,
): Promise<void> {
  if (event.payload.kind !== "generation") {
    logger.info(
      {
        eventId: event.eventId,
        jobId: event.jobId,
        kind: event.payload.kind,
      },
      "skipping generation-failed email for non-image job",
    );
    return;
  }

  const email = event.payload.email?.trim();
  const name = event.payload.name?.trim() || "there";
  if (!email) {
    logger.warn(
      { eventId: event.eventId, jobId: event.jobId, userId: event.userId },
      "generation.failed missing email — skipping notification",
    );
    return;
  }

  logger.info(
    {
      eventId: event.eventId,
      correlationId: event.correlationId,
      userId: event.userId,
      jobId: event.jobId,
      email,
      error: event.payload.error,
    },
    "generation failed email requested",
  );

  await mail.sendTemplate(email, "generation-failed", {
    name,
    error: event.payload.error,
  });
}
