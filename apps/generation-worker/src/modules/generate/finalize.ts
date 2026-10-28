import {
  RoutingKeys,
  type GenerationCompletedPayload,
  type GenerationFailedPayload,
  type PlatformEvent,
} from "@platform/messaging-contract";
import type {
  GenerationJob,
  GenerationJobStatus,
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client.js";
import { buildGenerationCompletedEvent } from "../../lib/events.js";

const NON_TERMINAL: GenerationJobStatus[] = [
  "created",
  "reserved",
  "processing",
];

const TERMINAL: GenerationJobStatus[] = ["captured", "failed", "released"];

export interface FinalizeDeps {
  prisma: PrismaClient;
}

export interface FinalizeResult {
  finalized: boolean;
}

export interface AssistantCompletionData {
  imageUrl: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  interactionId?: string | null;
}

/**
 * Claim the job as `captured`, persist the assistant image + session head, and
 * store the matching `generation.completed` event in one transaction.
 *
 * The `updateMany` status predicate is the compare-and-set claim: concurrent
 * finalizers produce exactly one winner and the loser writes nothing.
 */
export async function finalizeCompleted(
  deps: FinalizeDeps,
  input: {
    jobId: string;
    /** Assistant message that produced the image, when this job has one. */
    assistantId?: string;
    /**
     * Image fields to write when the assistant row has not been completed yet.
     * Omit on the reconcile path where the row already holds the image.
     */
    assistant?: AssistantCompletionData;
    sessionId?: string;
    /**
     * Provider continuation to store on the session. `undefined` leaves the
     * session head untouched; `null` clears it.
     */
    interactionId?: string | null;
    event: PlatformEvent<GenerationCompletedPayload>;
  },
): Promise<FinalizeResult> {
  return deps.prisma.$transaction(async (tx) => {
    const claimed = await tx.generationJob.updateMany({
      where: { id: input.jobId, status: { in: NON_TERMINAL } },
      data: { status: "captured", completedAt: new Date(), error: null },
    });
    if (claimed.count === 0) return { finalized: false };

    if (input.assistantId) {
      await tx.generationMessage.update({
        where: { id: input.assistantId },
        data: {
          status: "completed",
          completedAt: new Date(),
          error: null,
          ...(input.assistant
            ? {
                imageUrl: input.assistant.imageUrl,
                mimeType: input.assistant.mimeType,
                width: input.assistant.width ?? null,
                height: input.assistant.height ?? null,
                interactionId: input.assistant.interactionId ?? null,
              }
            : {}),
        },
      });
    }

    if (input.sessionId && input.assistantId) {
      await tx.generationSession.updateMany({
        where: { id: input.sessionId },
        data: {
          latestMessageId: input.assistantId,
          latestAssistantMessageId: input.assistantId,
          ...(input.interactionId !== undefined
            ? { latestInteractionId: input.interactionId }
            : {}),
        },
      });
    }

    await tx.generationOutbox.create({
      data: {
        id: input.event.eventId,
        jobId: input.jobId,
        routingKey: RoutingKeys.GENERATION_COMPLETED,
        payload: toJson(input.event),
      },
    });

    return { finalized: true };
  });
}

/**
 * Claim the job as `failed`, fail a non-completed assistant row, and store the
 * matching `generation.failed` event in one transaction. The wallet releases
 * when it consumes the event.
 *
 * A completed assistant row is never overwritten here; callers must route that
 * case through `finalizeCompleted` instead.
 */
export async function finalizeFailed(
  deps: FinalizeDeps,
  input: {
    jobId: string;
    assistantId?: string;
    reason: string;
    event: PlatformEvent<GenerationFailedPayload>;
  },
): Promise<FinalizeResult> {
  return deps.prisma.$transaction(async (tx) => {
    const claimed = await tx.generationJob.updateMany({
      where: { id: input.jobId, status: { in: NON_TERMINAL } },
      data: { status: "failed", completedAt: new Date(), error: input.reason },
    });
    if (claimed.count === 0) return { finalized: false };

    if (input.assistantId) {
      await tx.generationMessage.updateMany({
        where: { id: input.assistantId, status: { not: "completed" } },
        data: {
          status: "failed",
          error: input.reason,
          completedAt: new Date(),
        },
      });
    }

    await tx.generationOutbox.create({
      data: {
        id: input.event.eventId,
        jobId: input.jobId,
        routingKey: RoutingKeys.GENERATION_FAILED,
        payload: toJson(input.event),
      },
    });

    return { finalized: true };
  });
}

/**
 * Backfill a terminal event for a job that finished before the outbox existed
 * (or whose event row was lost). Only jobs with a delivered image can be
 * reconstructed; enhance jobs have nothing to rebuild the payload from.
 */
export async function ensureTerminalEvent(
  deps: FinalizeDeps,
  job: GenerationJob,
  payload: { userId: string; email?: string; name?: string; correlationId: string },
): Promise<boolean> {
  const existing = await deps.prisma.generationOutbox.findUnique({
    where: { jobId: job.id },
  });
  if (existing) return false;

  if (!job.messageId) return false;

  const assistant = await deps.prisma.generationMessage.findUnique({
    where: { id: job.messageId },
  });
  if (assistant?.status !== "completed" || !assistant.imageUrl) return false;

  const event = buildGenerationCompletedEvent({
    userId: payload.userId,
    jobId: job.id,
    correlationId: payload.correlationId,
    payload: {
      kind: "generation",
      imageUrls: [assistant.imageUrl],
      email: payload.email,
      name: payload.name,
    },
  });

  try {
    await deps.prisma.generationOutbox.create({
      data: {
        id: event.eventId,
        jobId: job.id,
        routingKey: RoutingKeys.GENERATION_COMPLETED,
        payload: toJson(event),
      },
    });
    return true;
  } catch (error) {
    // Another worker backfilled it first.
    if (isUniqueConstraintError(error)) return false;
    throw error;
  }
}

export function isTerminalJobStatus(status: GenerationJobStatus): boolean {
  return TERMINAL.includes(status);
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
