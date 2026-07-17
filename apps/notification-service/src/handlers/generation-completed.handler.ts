import type { Logger } from "@platform/logger";
import type {
  GenerationCompletedPayload,
  PlatformEvent,
} from "@platform/messaging-contract";
import type { MailService } from "../services/mail.service.js";

export async function handleGenerationCompleted(
  event: PlatformEvent<GenerationCompletedPayload>,
  mail: MailService,
  logger: Logger,
): Promise<void> {
  // Thumbnail emails only — prompt_enhance stays silent for now.
  if (event.payload.kind !== "generation") {
    logger.info(
      {
        eventId: event.eventId,
        jobId: event.jobId,
        kind: event.payload.kind,
      },
      "skipping generation-completed email for non-image job",
    );
    return;
  }

  const email = event.payload.email?.trim();
  const name = event.payload.name?.trim() || "there";
  if (!email) {
    logger.warn(
      { eventId: event.eventId, jobId: event.jobId, userId: event.userId },
      "generation.completed missing email — skipping notification",
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
      imageCount: event.payload.imageUrls?.length ?? 0,
    },
    "generation completed email requested",
  );

  await mail.sendTemplate(email, "generation-completed", { name });
}
