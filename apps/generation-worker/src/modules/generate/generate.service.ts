import { randomUUID } from "node:crypto";
import { AppError } from "@platform/errors";
import type { Logger } from "@platform/logger";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import {
  publishGenerationCompleted,
  publishGenerationFailed,
} from "../../lib/events.js";
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
import type { S3StorageService } from "../../storage/index.js";
import {
  createGenerationJob,
  updateJobStatus,
} from "../jobs/job.service.js";
import {
  completeAssistantMessage,
  createAssistantMessage,
  createUserMessage,
  failAssistantMessage,
  setUserProviderInput,
  toPublicMessage,
  updateSessionPointers,
} from "../messages/message.service.js";
import {
  ensureSession,
  findSessionByIdForUser,
} from "../sessions/session.service.js";
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
    },
  ) {}

  async generate(input: {
    user: WalletUserHeaders;
    body: GenerateRequestBody;
    correlationId: string;
    idempotencyKey?: string;
  }): Promise<GenerateResult> {
    const { prisma, logger, wallet, rabbitmq } = this.deps;
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
    const isFirstTurn = !session.latestInteractionId;

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

    const quote = await wallet.quote(input.user, { kind: "generation" });

    const userMessage = await createUserMessage(prisma, {
      sessionId: session.id,
      modelId: model.id,
      originalPrompt: input.body.originalPrompt,
      enhancedPrompt: input.body.enhancedPrompt ?? null,
      usedEnhancedPrompt: Boolean(input.body.usedEnhancedPrompt),
      providerInput,
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
    });

    await setUserProviderInput(prisma, userMessage.id, providerInput);

    const assistantMessage = await createAssistantMessage(prisma, {
      sessionId: session.id,
      modelId: model.id,
      referenceId: userMessage.id,
      status: "queued",
    });

    const job = await createGenerationJob(prisma, {
      userId,
      kind: "generation",
      coinCost: quote.coinCost,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
      sessionId: session.id,
      messageId: assistantMessage.id,
    });

    try {
      await wallet.reserve(input.user, {
        jobId: job.id,
        amount: quote.coinCost,
      });
      await updateJobStatus(prisma, job.id, "reserved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Wallet reserve failed";
      await failAssistantMessage(prisma, assistantMessage.id, message);
      await updateJobStatus(prisma, job.id, "failed", message);
      throw error;
    }

    await updateJobStatus(prisma, job.id, "processing");
    await prisma.generationMessage.update({
      where: { id: assistantMessage.id },
      data: { status: "processing" },
    });

    try {
      const fake = Boolean(this.deps.fakeImageGeneration);

      logger.info(
        {
          correlationId: input.correlationId,
          sessionId: session.id,
          modelId: model.id,
          provider: model.provider,
          isFirstTurn,
          jobId: job.id,
          coinCost: quote.coinCost,
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
        // Tiny 1x1 PNG — used only when S3 is configured; otherwise placeholder URL.
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
        // Real LLM path
        const provider = createImageProvider(model.provider, {
          geminiApiKey: this.deps.geminiApiKey,
          openaiApiKey: this.deps.openaiApiKey,
        });

        // Load refs from S3 so Gemini receives inline image parts (not just URLs
        // stored on the message). Private buckets cannot be fetched by Gemini.
        const referenceImages = await resolveReferenceImages(
          this.deps.storage,
          input.body.referenceImageUrls ?? [],
        );

        const result = await provider.generate({
          model: model.providerModelId,
          input: providerInput,
          aspectRatio: input.body.requiredAspectRatio,
          resolution: input.body.requiredResolution,
          previousInteractionId: isFirstTurn
            ? null
            : session.latestInteractionId,
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

      const completedAssistant = await completeAssistantMessage(
        prisma,
        assistantMessage.id,
        {
          imageUrl,
          mimeType,
          width,
          height,
          interactionId,
        },
      );

      const updatedSession = await updateSessionPointers(prisma, session.id, {
        latestMessageId: completedAssistant.id,
        latestAssistantMessageId: completedAssistant.id,
        latestInteractionId: interactionId ?? session.latestInteractionId,
      });

      // Wallet capture happens asynchronously via wallet-service on this event.
      await publishGenerationCompleted(rabbitmq, {
        userId,
        jobId: job.id,
        correlationId: input.correlationId,
        payload: {
          kind: "generation",
          imageUrls: [imageUrl],
          email: input.user.email,
          name: input.user.name,
        },
      });

      await updateJobStatus(prisma, job.id, "captured");

      const freshUser = await prisma.generationMessage.findUniqueOrThrow({
        where: { id: userMessage.id },
      });

      return {
        session: {
          id: updatedSession.id,
          latestInteractionId: updatedSession.latestInteractionId,
          latestMessageId: updatedSession.latestMessageId,
          latestAssistantMessageId: updatedSession.latestAssistantMessageId,
        },
        userMessage: toPublicMessage(freshUser),
        assistantMessage: toPublicMessage(completedAssistant),
        job: {
          id: job.id,
          status: "captured",
          coinCost: quote.coinCost,
          billing: "reserved_then_capture_via_event",
        },
        providerInput,
        isFirstTurn,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image generation failed";
      await failAssistantMessage(prisma, assistantMessage.id, message);
      await updateJobStatus(prisma, job.id, "failed", message);

      logger.error(
        {
          err: error,
          correlationId: input.correlationId,
          jobId: job.id,
          sessionId: session.id,
        },
        "image generation failed",
      );

      try {
        await publishGenerationFailed(rabbitmq, {
          userId,
          jobId: job.id,
          correlationId: input.correlationId,
          payload: {
            kind: "generation",
            error: message,
            email: input.user.email,
            name: input.user.name,
          },
        });
      } catch (publishError) {
        logger.error(
          { err: publishError, jobId: job.id },
          "failed to publish generation.failed — attempting sync release",
        );
        try {
          await wallet.release(input.user, { jobId: job.id });
          await updateJobStatus(prisma, job.id, "released", message);
        } catch (releaseError) {
          logger.error(
            { err: releaseError, jobId: job.id },
            "sync wallet release failed after generation error",
          );
        }
      }

      if (error instanceof AppError) throw error;
      throw new AppError("INTERNAL_ERROR", message, 500);
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
