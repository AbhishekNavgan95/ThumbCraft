import { Worker, type Job } from "bullmq";
import type { Logger } from "@platform/logger";
import type { Redis } from "ioredis";
import type { GenerateService } from "../modules/generate/generate.service.js";
import {
  GENERATION_QUEUE_NAME,
  type GenerationJobPayload,
} from "./generation.queue.js";

export function startGenerationWorker(deps: {
  connection: Redis;
  generateService: GenerateService;
  logger: Logger;
}): Worker<GenerationJobPayload> {
  const { connection, generateService, logger } = deps;

  const worker = new Worker<GenerationJobPayload>(
    GENERATION_QUEUE_NAME,
    async (job: Job<GenerationJobPayload>) => {
      const { jobId, correlationId } = job.data;
      logger.info(
        {
          bullJobId: job.id,
          jobId,
          attempt: job.attemptsMade + 1,
          correlationId,
        },
        "processing image generation job",
      );
      await generateService.processQueuedJob(job.data);
    },
    {
      connection,
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    logger.info(
      { bullJobId: job.id, jobId: job.data.jobId },
      "image generation job completed",
    );
  });

  worker.on("failed", (job, error) => {
    const attempts = job?.opts.attempts ?? 1;
    const attemptsMade = job?.attemptsMade ?? 0;
    const exhausted = attemptsMade >= attempts;

    logger.error(
      {
        err: error,
        bullJobId: job?.id,
        jobId: job?.data.jobId,
        attemptsMade,
        attempts,
        exhausted,
      },
      "image generation job failed",
    );

    if (exhausted && job?.data) {
      const message =
        error instanceof Error ? error.message : "Image generation failed";
      void generateService.finalizeJobFailure(job.data, message).catch((err) => {
        logger.error(
          { err, jobId: job.data.jobId },
          "finalizeJobFailure failed",
        );
      });
    }
  });

  return worker;
}
