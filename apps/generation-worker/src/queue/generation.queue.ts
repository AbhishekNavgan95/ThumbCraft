import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export const GENERATION_QUEUE_NAME = "image-generation";

export interface GenerationJobPayload {
  /** Matches `generation_jobs.id` — also used as BullMQ jobId. */
  jobId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  correlationId: string;
}

export function createGenerationQueue(connection: Redis): Queue<GenerationJobPayload> {
  return new Queue<GenerationJobPayload>(GENERATION_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    },
  });
}

export async function enqueueGenerationJob(
  queue: Queue<GenerationJobPayload>,
  payload: GenerationJobPayload,
): Promise<void> {
  await queue.add("generate", payload, {
    jobId: payload.jobId,
  });
}
