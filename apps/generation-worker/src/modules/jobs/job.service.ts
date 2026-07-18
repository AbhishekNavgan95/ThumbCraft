import { AppError } from "@platform/errors";
import type {
  GenerationJobKind,
  GenerationJobStatus,
  PrismaClient,
} from "../../generated/prisma/client.js";

export async function createGenerationJob(
  prisma: PrismaClient,
  input: {
    userId: string;
    kind: GenerationJobKind;
    coinCost: number;
    idempotencyKey: string;
    sessionId?: string;
    messageId?: string;
  },
) {
  try {
    return await prisma.generationJob.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        coinCost: input.coinCost,
        idempotencyKey: input.idempotencyKey,
        sessionId: input.sessionId,
        messageId: input.messageId,
        status: "created",
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      const existing = await prisma.generationJob.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        throw new AppError(
          "CONFLICT",
          "A job with this idempotency key already exists",
          409,
          { jobId: existing.id, status: existing.status },
        );
      }
    }
    throw error;
  }
}

export async function updateJobStatus(
  prisma: PrismaClient,
  jobId: string,
  status: GenerationJobStatus,
  error?: string | null,
) {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status,
      error: error ?? null,
      ...(status === "captured" ||
      status === "released" ||
      status === "failed"
        ? { completedAt: new Date() }
        : {}),
    },
  });
}

export async function findJobByIdForUser(
  prisma: PrismaClient,
  userId: string,
  jobId: string,
) {
  return prisma.generationJob.findFirst({
    where: { id: jobId, userId },
  });
}

export function toPublicJob(job: {
  id: string;
  userId: string;
  sessionId: string | null;
  messageId: string | null;
  kind: string;
  status: string;
  coinCost: number;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: job.id,
    sessionId: job.sessionId,
    messageId: job.messageId,
    kind: job.kind,
    status: job.status,
    coinCost: job.coinCost,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}
