import type { PrismaClient } from "../../generated/prisma/client.js";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import { AppError } from "@platform/errors";
import type { Logger } from "@platform/logger";
import {
  publishGenerationCompleted,
  publishGenerationFailed,
} from "../../lib/events.js";
import type { WalletClient, WalletUserHeaders } from "../../lib/wallet-client.js";
import { createOpenAIClient } from "../../providers/openai/openai.client.js";
import { PromptEnhancer } from "../../providers/openai/prompt-enhancer.js";
import {
  createGenerationJob,
  updateJobStatus,
} from "../jobs/job.service.js";

export class EnhanceService {
  private readonly enhancer: PromptEnhancer;

  constructor(
    private readonly deps: {
      prisma: PrismaClient;
      rabbitmq: RabbitMQClient;
      wallet: WalletClient;
      logger: Logger;
      openaiApiKey?: string;
      enhanceModel: string;
    },
  ) {
    if (!deps.openaiApiKey?.trim()) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "OPENAI_API_KEY is not configured",
        503,
      );
    }

    const openai = createOpenAIClient(deps.openaiApiKey);
    this.enhancer = new PromptEnhancer(openai, deps.enhanceModel);
  }

  async enhancePrompt(input: {
    user: WalletUserHeaders;
    originalPrompt: string;
    idempotencyKey: string;
    correlationId: string;
  }) {
    const quote = await this.deps.wallet.quote(input.user, {
      kind: "prompt_enhance",
    });

    const job = await createGenerationJob(this.deps.prisma, {
      userId: input.user.userId,
      kind: "prompt_enhance",
      coinCost: quote.coinCost,
      idempotencyKey: input.idempotencyKey,
    });

    try {
      await this.deps.wallet.reserve(input.user, {
        jobId: job.id,
        amount: quote.coinCost,
      });
      await updateJobStatus(this.deps.prisma, job.id, "reserved");
    } catch (error) {
      await updateJobStatus(
        this.deps.prisma,
        job.id,
        "failed",
        error instanceof Error ? error.message : "Reserve failed",
      );
      throw error;
    }

    await updateJobStatus(this.deps.prisma, job.id, "processing");

    try {
      const result = await this.enhancer.enhance(input.originalPrompt);

      await publishGenerationCompleted(this.deps.rabbitmq, {
        userId: input.user.userId,
        jobId: job.id,
        correlationId: input.correlationId,
        payload: {
          kind: "prompt_enhance",
          enhancedPrompt: result.enhancedPrompt,
          email: input.user.email,
          name: input.user.name,
        },
      });

      await updateJobStatus(this.deps.prisma, job.id, "captured");

      return {
        jobId: job.id,
        originalPrompt: input.originalPrompt,
        enhancedPrompt: result.enhancedPrompt,
        coinCost: quote.coinCost,
        model: result.model,
        systemPromptKey: result.systemPromptKey,
        systemPromptVersion: result.systemPromptVersion,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Prompt enhancement failed";

      await updateJobStatus(this.deps.prisma, job.id, "failed", message);

      try {
        await publishGenerationFailed(this.deps.rabbitmq, {
          userId: input.user.userId,
          jobId: job.id,
          correlationId: input.correlationId,
          payload: {
            kind: "prompt_enhance",
            error: message,
            email: input.user.email,
            name: input.user.name,
          },
        });
      } catch (publishError) {
        this.deps.logger.error(
          { err: publishError, jobId: job.id },
          "failed to publish generation.failed — attempting sync release",
        );
        try {
          await this.deps.wallet.release(input.user, { jobId: job.id });
          await updateJobStatus(this.deps.prisma, job.id, "released", message);
        } catch (releaseError) {
          this.deps.logger.error(
            { err: releaseError, jobId: job.id },
            "sync wallet release failed after enhance error",
          );
        }
      }

      if (error instanceof AppError) throw error;
      throw new AppError("INTERNAL_ERROR", message, 500);
    }
  }
}
