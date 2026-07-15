import type { Logger } from "@platform/logger";
import type {
  GenerationCompletedPayload,
  GenerationFailedPayload,
  PlatformEvent,
} from "@platform/messaging-contract";
import type { PrismaClient } from "../generated/prisma/client.js";
import { captureCoins, releaseCoins } from "../services/wallet.service.js";

export async function handleGenerationCompleted(
  event: PlatformEvent<GenerationCompletedPayload>,
  prisma: PrismaClient,
  logger: Logger,
): Promise<void> {
  const jobId = event.jobId;
  if (!jobId) {
    logger.warn(
      { eventId: event.eventId },
      "generation.completed missing jobId — skipping capture",
    );
    return;
  }

  const result = await captureCoins(prisma, {
    userId: event.userId,
    jobId,
  });

  logger.info(
    {
      eventId: event.eventId,
      jobId,
      amount: result.amount,
      idempotent: result.idempotent,
    },
    "wallet capture from generation.completed",
  );
}

export async function handleGenerationFailed(
  event: PlatformEvent<GenerationFailedPayload>,
  prisma: PrismaClient,
  logger: Logger,
): Promise<void> {
  const jobId = event.jobId;
  if (!jobId) {
    logger.warn(
      { eventId: event.eventId },
      "generation.failed missing jobId — skipping release",
    );
    return;
  }

  const result = await releaseCoins(prisma, {
    userId: event.userId,
    jobId,
  });

  logger.info(
    {
      eventId: event.eventId,
      jobId,
      amount: result.amount,
      idempotent: result.idempotent,
      error: event.payload.error,
    },
    "wallet release from generation.failed",
  );
}
