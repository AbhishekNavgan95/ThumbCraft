import { randomUUID } from "node:crypto";
import { AppError } from "@platform/errors";
import type { Logger } from "@platform/logger";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import type { Queue } from "bullmq";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import {
  buildGenerationCompletedEvent,
  buildGenerationFailedEvent,
} from "../../lib/events.js";
import { relayOutbox } from "../../lib/outbox.js";
import type {
  WalletClient,
  WalletUserHeaders,
} from "../../lib/wallet-client.js";
import {
  PREFERENCE_CATALOG_VERSION,
  resolveProviderInput,
  resolveUserText,
  type ThumbnailPreferences,
} from "../../prompts/index.js";
import { createImageProvider } from "../../providers/index.js";
import type { GenerationJobPayload } from "../../queue/generation.queue.js";
import { enqueueGenerationJob } from "../../queue/generation.queue.js";
import type { S3StorageService } from "../../storage/index.js";
import {
  createGenerationJob,
  updateJobStatus,
} from "../jobs/job.service.js";
import {
  createAssistantMessage,
  createUserMessage,
  failAssistantMessage,
  setUserProviderInput,
  toPublicMessage,
} from "../messages/message.service.js";
import {
  ensureSession,
  findSessionByIdForUser,
} from "../sessions/session.service.js";
import {
  ensureTerminalEvent,
  finalizeCompleted,
  finalizeFailed,
  isTerminalJobStatus,
} from "./finalize.js";
import type { GenerateRequestBody, GenerateResult } from "./generate.types.js";

export class GenerateService {
  constructor(
    private readonly deps: {
      prisma: PrismaClient;
      rabbitmq: RabbitMQClient;
      wallet: WalletClient;
      logger: Logger;
      geminiApiKey?: string;
      openaiApiKey?: string;
      storage: S3StorageService | null;
      /** Skip real LLM — return a placeholder image URL. */
      fakeImageGeneration?: boolean;
      generationQueue: Queue<GenerationJobPayload>;
    },
  ) {}

  /**
   * HTTP path: validate → persist messages → reserve coins → enqueue BullMQ.
   * Returns immediately; LLM runs in `processQueuedJob`.
   */
  async generate(input: {
    user: WalletUserHeaders;
    body: GenerateRequestBody;
    correlationId: string;
    idempotencyKey?: string;
  }): Promise<GenerateResult> {
    const { prisma, logger, wallet } = this.deps;
    const userId = input.user.userId;

    const model = await prisma.generationModel.findUnique({
      where: { id: input.body.modelId },
    });
    if (!model || !model.visible) {
      throw new AppError("NOT_FOUND", "Generation model not found", 404);
    }
    if (!model.supportedAspectRatios.includes(input.body.requiredAspectRatio)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `requiredAspectRatio must be one of: ${model.supportedAspectRatios.join(", ")}`,
        422,
      );
    }
    if (!model.supportedResolutions.includes(input.body.requiredResolution)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `requiredResolution must be one of: ${model.supportedResolutions.join(", ")}`,
        422,
      );
    }

    const session = await this.resolveSession(userId, input.body.sessionId);
    const quote = await wallet.quote(input.user, { kind: "generation" });

    let result: any;
    try {
      // Allocate turn sequence atomically
      const updatedSession = await prisma.$queryRaw<Array<{ turn_seq: number }>>`
        UPDATE generation_sessions
        SET turn_seq = turn_seq + 1
        WHERE id = ${session.id}::uuid
        RETURNING turn_seq
      `;
      const turnSeq = updatedSession[0]?.turn_seq ?? 1;
      const isFirstTurn = turnSeq === 1;

      const preferences: ThumbnailPreferences = input.body.preferences ?? {};
      const userText = resolveUserText({
        originalPrompt: input.body.originalPrompt,
        enhancedPrompt: input.body.enhancedPrompt,
        usedEnhancedPrompt: input.body.usedEnhancedPrompt,
      });

      const providerInput = resolveProviderInput({
        isFirstTurn,
        userText,
        preferences,
      });

      const userMessage = await createUserMessage(prisma as any, {
        sessionId: session.id,
        modelId: model.id,
        originalPrompt: input.body.originalPrompt,
        enhancedPrompt: input.body.enhancedPrompt ?? null,
        usedEnhancedPrompt: Boolean(input.body.usedEnhancedPrompt),
        providerInput: null,
        preferences: {
          ...preferences,
          _catalogVersion: PREFERENCE_CATALOG_VERSION,
        } as Prisma.InputJsonValue,
        referenceImageUrls: input.body.referenceImageUrls ?? [],
        referenceTemplateIds: input.body.referenceTemplateIds ?? [],
        requiredAspectRatio: input.body.requiredAspectRatio,
        requiredResolution: input.body.requiredResolution,
        metadata: {
          correlationId: input.correlationId,
          isFirstTurn,
        },
        turnSeq,
      });

      const assistantMessage = await createAssistantMessage(prisma as any, {
        sessionId: session.id,
        modelId: model.id,
        referenceId: userMessage.id,
        status: "queued",
        turnSeq,
      });

      const job = await createGenerationJob(prisma as any, {
        userId,
        kind: "generation",
        coinCost: quote.coinCost,
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
        sessionId: session.id,
        messageId: assistantMessage.id,
        turnSeq,
      });

      result = { userMessage, assistantMessage, job, turnSeq, isFirstTurn, providerInput };
    } catch (error) {
      // A partial unique index allows one non-terminal generation job per
      // session. Losing that race is a product state, not a validation error.
      if (isUniqueConstraintError(error)) {
        const activeJob = await prisma.generationJob.findFirst({
          where: {
            sessionId: session.id,
            kind: "generation",
            status: { in: ["created", "reserved", "processing"] },
          },
          select: { id: true },
        });
        if (activeJob) {
          throw new AppError(
            "SESSION_BUSY",
            "This chat is still generating. Wait for the current image.",
            409,
            { jobId: activeJob.id },
          );
        }
      }
      throw error;
    }

    const { userMessage, assistantMessage, job, isFirstTurn, providerInput } = result;

    try {
      await wallet.reserve(input.user, {
        jobId: job.id,
        amount: quote.coinCost,
      });
      await updateJobStatus(prisma, job.id, "reserved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Wallet reserve failed";
      try {
        await failAssistantMessage(prisma, assistantMessage.id, message);
        await updateJobStatus(prisma, job.id, "failed", message);
      } catch {}
      throw error;
    }

    await updateJobStatus(prisma, job.id, "processing");
    await prisma.generationMessage.update({
      where: { id: assistantMessage.id },
      data: { status: "processing" },
    });

    try {
      await enqueueGenerationJob(this.deps.generationQueue, {
        jobId: job.id,
        userId,
        email: input.user.email,
        name: input.user.name,
        role: input.user.role,
        correlationId: input.correlationId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to enqueue generation";
      await failAssistantMessage(prisma, assistantMessage.id, message);
      await updateJobStatus(prisma, job.id, "failed", message);
      try {
        await wallet.release(input.user, { jobId: job.id });
        await updateJobStatus(prisma, job.id, "released", message);
      } catch (releaseError) {
        logger.error(
          { err: releaseError, jobId: job.id },
          "wallet release failed after enqueue error",
        );
      }
      throw new AppError("SERVICE_UNAVAILABLE", message, 503);
    }

    logger.info(
      {
        correlationId: input.correlationId,
        sessionId: session.id,
        jobId: job.id,
        coinCost: quote.coinCost,
      },
      "generation job enqueued",
    );

    const freshAssistant = await prisma.generationMessage.findUniqueOrThrow({
      where: { id: assistantMessage.id },
    });
    const freshUser = await prisma.generationMessage.findUniqueOrThrow({
      where: { id: userMessage.id },
    });
    const freshJob = await prisma.generationJob.findUniqueOrThrow({
      where: { id: job.id },
    });

    return {
      session: {
        id: session.id,
        latestInteractionId: session.latestInteractionId,
        latestMessageId: session.latestMessageId,
        latestAssistantMessageId: session.latestAssistantMessageId,
      },
      userMessage: toPublicMessage(freshUser),
      assistantMessage: toPublicMessage(freshAssistant),
      job: {
        id: freshJob.id,
        status: freshJob.status,
        coinCost: quote.coinCost,
        billing: "reserved_then_capture_via_event",
      },
      providerInput,
      isFirstTurn,
    };
  }

  /**
   * BullMQ worker path: run LLM / fake generation for a reserved job.
   * Retries rethrow until attempts are exhausted. The expired attempt is
   * finalized by `finalizeJobFailure`, which stores the release event.
   */
  async processQueuedJob(payload: GenerationJobPayload): Promise<void> {
    const { prisma, logger } = this.deps;
    const { jobId, userId, correlationId } = payload;

    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new AppError("NOT_FOUND", `Generation job not found: ${jobId}`, 404);
    }
    if (isTerminalJobStatus(job.status)) {
      if (job.status === "captured") {
        // A legacy/stale row may have finished before the outbox existed.
        await ensureTerminalEvent(this.deps, job, payload);
        await this.tryRelayOutbox();
      }
      logger.info({ jobId, status: job.status }, "skipping already-finished job");
      return;
    }
    if (job.kind !== "generation" || !job.messageId || !job.sessionId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Job is not a valid image generation job",
        422,
      );
    }

    const assistantMessage = await prisma.generationMessage.findUnique({
      where: { id: job.messageId },
    });
    if (!assistantMessage || !assistantMessage.referenceId) {
      throw new AppError(
        "NOT_FOUND",
        "Assistant message missing for generation job",
        404,
      );
    }

    const session = await prisma.generationSession.findUnique({
      where: { id: job.sessionId },
    });
    if (!session) {
      throw new AppError("NOT_FOUND", "Session missing for generation job", 404);
    }

    if (assistantMessage.status === "completed") {
      if (assistantMessage.imageUrl) {
        // The image exists. Finish the job, never strand or refund it.
        await finalizeCompleted(this.deps, {
          jobId: job.id,
          assistantId: assistantMessage.id,
          sessionId: session.id,
          interactionId:
            assistantMessage.interactionId ?? session.latestInteractionId,
          event: buildGenerationCompletedEvent({
            userId,
            jobId: job.id,
            correlationId,
            payload: {
              kind: "generation",
              imageUrls: [assistantMessage.imageUrl],
              email: payload.email,
              name: payload.name,
            },
          }),
        });
        await this.tryRelayOutbox();
        return;
      }

      // A completed row without an image did not deliver anything.
      logger.error(
        { jobId },
        "assistant message is completed but has no image — failing job",
      );
      await finalizeFailed(this.deps, {
        jobId: job.id,
        assistantId: assistantMessage.id,
        reason: "Assistant message completed without an image",
        event: buildGenerationFailedEvent({
          userId,
          jobId: job.id,
          correlationId,
          payload: {
            kind: "generation",
            error: "Assistant message completed without an image",
            email: payload.email,
            name: payload.name,
          },
        }),
      });
      await this.tryRelayOutbox();
      return;
    }

    const userMessage = await prisma.generationMessage.findUnique({
      where: { id: assistantMessage.referenceId },
    });
    if (!userMessage) {
      throw new AppError("NOT_FOUND", "User message missing for generation job", 404);
    }

    const model = await prisma.generationModel.findUnique({
      where: { id: assistantMessage.modelId },
    });
    if (!model) {
      throw new AppError("NOT_FOUND", "Model missing for generation job", 404);
    }

    const aspectRatio = userMessage.requiredAspectRatio;
    const resolution = userMessage.requiredResolution;
    if (!aspectRatio || !resolution) {
      throw new AppError(
        "VALIDATION_ERROR",
        "User message missing aspect ratio or resolution",
        422,
      );
    }

    // Decide framing at execution time from session head
    const isFirstTurn = (userMessage.turnSeq ?? 0) === 1;
    const superseded = (userMessage.turnSeq ?? 0) < (session.turnSeq ?? 0);

    if (superseded) {
      logger.warn(
        { jobId, turnSeq: userMessage.turnSeq, head: session.turnSeq },
        "superseded turn",
      );
    }

    // Compute providerInput at execution time
    const preferences = (userMessage.preferences as ThumbnailPreferences) ?? {};
    const userText = resolveUserText({
      originalPrompt: userMessage.originalPrompt ?? "",
      enhancedPrompt: userMessage.enhancedPrompt,
      usedEnhancedPrompt: userMessage.usedEnhancedPrompt,
    });

    const providerInput = resolveProviderInput({
      isFirstTurn,
      userText,
      preferences,
    }).trim();

    if (!providerInput) {
      throw new AppError(
        "VALIDATION_ERROR",
        "User message has no providerInput",
        422,
      );
    }

    await setUserProviderInput(prisma, userMessage.id, providerInput);

    try {
      const fake = Boolean(this.deps.fakeImageGeneration);

      logger.info(
        {
          correlationId,
          sessionId: session.id,
          modelId: model.id,
          provider: model.provider,
          isFirstTurn,
          jobId,
          fakeImageGeneration: fake,
        },
        fake
          ? "starting FAKE image generation (LLM skipped)"
          : "starting image generation",
      );

      let imageUrl: string;
      let mimeType: string;
      let width: number | null = null;
      let height: number | null = null;
      let interactionId: string | null = null;

      if (fake) {
        const fakePng = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64",
        );
        mimeType = "image/png";
        width = 1;
        height = 1;
        interactionId = `fake-interaction-${randomUUID()}`;

        if (this.deps.storage) {
          const uploaded = await this.deps.storage.uploadBuffer({
            buffer: fakePng,
            contentType: mimeType,
            folder: "generated",
            userId,
            sessionId: session.id,
            objectId: assistantMessage.id,
          });
          imageUrl = uploaded.url;
        } else {
          imageUrl = `https://placehold.co/1280x720/png?text=Fake+Thumbnail`;
          logger.warn(
            "FAKE_IMAGE_GENERATION on and S3 not configured — using placeholder URL",
          );
        }
      } else {
        const provider = createImageProvider(model.provider, {
          geminiApiKey: this.deps.geminiApiKey,
          openaiApiKey: this.deps.openaiApiKey,
        });

        const referenceImages = await resolveReferenceImages(
          this.deps.storage,
          userMessage.referenceImageUrls ?? [],
        );

        const result = await provider.generate({
          model: model.providerModelId,
          input: providerInput,
          aspectRatio,
          resolution,
          previousInteractionId: isFirstTurn || superseded ? null : session.latestInteractionId,
          referenceImages,
        });

        const firstImage = result.images[0];
        if (!firstImage) {
          throw new AppError(
            "INTERNAL_ERROR",
            "Provider returned no images",
            502,
          );
        }

        if (!this.deps.storage) {
          throw new AppError(
            "SERVICE_UNAVAILABLE",
            "Image storage is unavailable: AWS_S3_BUCKET is not configured",
            503,
          );
        }

        const uploaded = await this.deps.storage.uploadBuffer({
          buffer: firstImage.buffer,
          contentType: firstImage.mimeType,
          folder: "generated",
          userId,
          sessionId: session.id,
          objectId: assistantMessage.id,
        });

        imageUrl = uploaded.url;
        mimeType = firstImage.mimeType;
        width = firstImage.width ?? null;
        height = firstImage.height ?? null;
        interactionId = result.interactionId ?? null;
      }

      const event = buildGenerationCompletedEvent({
        userId,
        jobId: job.id,
        correlationId,
        payload: {
          kind: "generation",
          imageUrls: [imageUrl],
          email: payload.email,
          name: payload.name,
        },
      });

      await finalizeCompleted(this.deps, {
        jobId: job.id,
        assistantId: assistantMessage.id,
        assistant: { imageUrl, mimeType, width, height, interactionId },
        sessionId: session.id,
        interactionId: interactionId ?? session.latestInteractionId,
        event,
      });

      // The job is durably captured. A failed immediate publish only means the
      // outbox row waits for the next relay tick, so never rethrow for it.
      await this.tryRelayOutbox();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image generation failed";

      logger.error(
        {
          err: error,
          correlationId,
          jobId,
          sessionId: session.id,
        },
        "image generation failed (will retry if attempts remain)",
      );

      // Let BullMQ retry. The finalizer for exhausted retries lives in
      // `finalizeJobFailure`, invoked from the Worker's failed event.
      throw error instanceof AppError
        ? error
        : new AppError("INTERNAL_ERROR", message, 500);
    }
  }

  /**
   * Called when BullMQ has exhausted retries for a generation job.
   *
   * A delivered image always wins over the failure path: if the assistant row
   * is completed with an image, the job is captured and the coins stay spent.
   */
  async finalizeJobFailure(
    payload: GenerationJobPayload,
    errorMessage: string,
  ): Promise<void> {
    const { prisma, logger } = this.deps;
    const { jobId, userId, correlationId } = payload;

    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job || isTerminalJobStatus(job.status)) return;

    const assistant = job.messageId
      ? await prisma.generationMessage.findUnique({ where: { id: job.messageId } })
      : null;

    if (assistant?.status === "completed" && assistant.imageUrl) {
      logger.warn(
        { jobId },
        "job failed after delivering an image — capturing instead of refunding",
      );

      let sessionInteractionId: string | null | undefined;
      if (job.sessionId) {
        const session = await prisma.generationSession.findUnique({
          where: { id: job.sessionId },
        });
        if (session) {
          sessionInteractionId =
            assistant.interactionId ?? session.latestInteractionId;
        }
      }

      await finalizeCompleted(this.deps, {
        jobId,
        assistantId: assistant.id,
        sessionId: job.sessionId ?? undefined,
        interactionId: sessionInteractionId,
        event: buildGenerationCompletedEvent({
          userId,
          jobId,
          correlationId,
          payload: {
            kind: "generation",
            imageUrls: [assistant.imageUrl],
            email: payload.email,
            name: payload.name,
          },
        }),
      });

      await this.tryRelayOutbox();
      return;
    }

    await finalizeFailed(this.deps, {
      jobId,
      assistantId: job.messageId ?? undefined,
      reason: errorMessage,
      event: buildGenerationFailedEvent({
        userId,
        jobId,
        correlationId,
        payload: {
          kind: "generation",
          error: errorMessage,
          email: payload.email,
          name: payload.name,
        },
      }),
    });

    await this.tryRelayOutbox();
  }

  /**
   * Best-effort immediate publish. Failure is not an error: the event is
   * already durable and the scheduled relay will retry it.
   */
  private async tryRelayOutbox(): Promise<void> {
    try {
      await relayOutbox(this.deps);
    } catch (error) {
      this.deps.logger.warn(
        { err: error },
        "generation outbox relay attempt failed; next tick will retry",
      );
    }
  }

  private async resolveSession(userId: string, sessionId?: string) {
    if (sessionId) {
      const existing = await findSessionByIdForUser(
        this.deps.prisma,
        userId,
        sessionId,
      );
      if (!existing) {
        throw new AppError("NOT_FOUND", "Session not found", 404);
      }
      if (existing.status !== "active") {
        throw new AppError(
          "VALIDATION_ERROR",
          "Cannot generate in an archived session",
          422,
        );
      }
      return existing;
    }

    const { session } = await ensureSession(this.deps.prisma, userId);
    return session;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Gemini accepts up to 14 reference images per request. */
const MAX_REFERENCE_IMAGES = 14;

async function resolveReferenceImages(
  storage: S3StorageService | null,
  urls: string[],
): Promise<Array<{ base64: string; mimeType: string; url: string }>> {
  if (urls.length === 0) return [];

  if (!storage) {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "Image storage is unavailable: cannot load reference images",
      503,
    );
  }

  const limited = urls.slice(0, MAX_REFERENCE_IMAGES);
  return Promise.all(
    limited.map(async (url) => {
      const obj = await storage.getObjectBase64(url);
      return {
        url,
        base64: obj.data,
        mimeType: obj.mimeType,
      };
    }),
  );
}
