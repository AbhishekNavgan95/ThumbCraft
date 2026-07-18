import { AppError } from "@platform/errors";
import type { FastifyRequest } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { findJobByIdForUser, toPublicJob } from "./job.service.js";
import { toPublicMessage } from "../messages/message.service.js";

export async function getJobController(
  request: FastifyRequest,
  prisma: PrismaClient,
) {
  const user = request.user;
  if (!user) {
    throw new AppError("UNAUTHORIZED", "Missing authenticated user", 401);
  }

  const { jobId } = request.params as { jobId: string };
  const job = await findJobByIdForUser(prisma, user.id, jobId);
  if (!job) {
    throw new AppError("NOT_FOUND", "Job not found", 404);
  }

  let message = null;
  if (job.messageId) {
    const row = await prisma.generationMessage.findFirst({
      where: {
        id: job.messageId,
        session: { userId: user.id },
      },
    });
    if (row) {
      message = toPublicMessage(row);
    }
  }

  return {
    job: toPublicJob(job),
    message,
  };
}
