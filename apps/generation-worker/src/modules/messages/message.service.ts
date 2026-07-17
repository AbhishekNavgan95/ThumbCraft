import type {
  MessageRole,
  MessageStatus,
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client.js";
import { AppError } from "@platform/errors";

export interface CreateUserMessageInput {
  sessionId: string;
  modelId: string;
  originalPrompt: string;
  enhancedPrompt?: string | null;
  usedEnhancedPrompt?: boolean;
  providerInput?: string | null;
  preferences?: Prisma.InputJsonValue;
  referenceImageUrls?: string[];
  referenceTemplateIds?: string[];
  requiredAspectRatio: string;
  requiredResolution: string;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateAssistantMessageInput {
  sessionId: string;
  modelId: string;
  referenceId: string;
  status?: MessageStatus;
}

export function toPublicMessage(message: {
  id: string;
  sessionId: string;
  role: MessageRole;
  modelId: string;
  originalPrompt: string | null;
  enhancedPrompt: string | null;
  usedEnhancedPrompt: boolean;
  providerInput: string | null;
  preferences: unknown;
  referenceImageUrls: string[];
  referenceTemplateIds: string[];
  requiredAspectRatio: string | null;
  requiredResolution: string | null;
  referenceId: string | null;
  imageUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  interactionId: string | null;
  status: MessageStatus;
  error: string | null;
  completedAt: Date | null;
  metadata: unknown;
  createdAt: Date;
}) {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    modelId: message.modelId,
    originalPrompt: message.originalPrompt,
    enhancedPrompt: message.enhancedPrompt,
    usedEnhancedPrompt: message.usedEnhancedPrompt,
    providerInput: message.providerInput,
    preferences: message.preferences,
    referenceImageUrls: message.referenceImageUrls,
    referenceTemplateIds: message.referenceTemplateIds,
    requiredAspectRatio: message.requiredAspectRatio,
    requiredResolution: message.requiredResolution,
    referenceId: message.referenceId,
    imageUrl: message.imageUrl,
    mimeType: message.mimeType,
    width: message.width,
    height: message.height,
    interactionId: message.interactionId,
    status: message.status,
    error: message.error,
    completedAt: message.completedAt?.toISOString() ?? null,
    metadata: message.metadata,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function createUserMessage(
  prisma: PrismaClient,
  input: CreateUserMessageInput,
) {
  return prisma.generationMessage.create({
    data: {
      sessionId: input.sessionId,
      role: "user",
      modelId: input.modelId,
      originalPrompt: input.originalPrompt,
      enhancedPrompt: input.enhancedPrompt ?? null,
      usedEnhancedPrompt: input.usedEnhancedPrompt ?? false,
      providerInput: input.providerInput ?? null,
      preferences: input.preferences ?? {},
      referenceImageUrls: input.referenceImageUrls ?? [],
      referenceTemplateIds: input.referenceTemplateIds ?? [],
      requiredAspectRatio: input.requiredAspectRatio,
      requiredResolution: input.requiredResolution,
      metadata: input.metadata ?? {},
    },
  });
}

export async function createAssistantMessage(
  prisma: PrismaClient,
  input: CreateAssistantMessageInput,
) {
  return prisma.generationMessage.create({
    data: {
      sessionId: input.sessionId,
      role: "assistant",
      modelId: input.modelId,
      referenceId: input.referenceId,
      status: input.status ?? "queued",
      preferences: {},
      usedEnhancedPrompt: false,
      referenceImageUrls: [],
      referenceTemplateIds: [],
      metadata: {},
    },
  });
}

export async function setUserProviderInput(
  prisma: PrismaClient,
  messageId: string,
  providerInput: string,
) {
  return prisma.generationMessage.update({
    where: { id: messageId },
    data: { providerInput },
  });
}

export async function completeAssistantMessage(
  prisma: PrismaClient,
  messageId: string,
  data: {
    imageUrl: string;
    mimeType: string;
    width?: number | null;
    height?: number | null;
    interactionId?: string | null;
  },
) {
  return prisma.generationMessage.update({
    where: { id: messageId },
    data: {
      status: "completed",
      imageUrl: data.imageUrl,
      mimeType: data.mimeType,
      width: data.width ?? null,
      height: data.height ?? null,
      interactionId: data.interactionId ?? null,
      completedAt: new Date(),
      error: null,
    },
  });
}

export async function failAssistantMessage(
  prisma: PrismaClient,
  messageId: string,
  error: string,
) {
  return prisma.generationMessage.update({
    where: { id: messageId },
    data: {
      status: "failed",
      error,
      completedAt: new Date(),
    },
  });
}

export async function listMessagesForSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
) {
  const session = await prisma.generationSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  if (!session) {
    throw new AppError("NOT_FOUND", "Session not found", 404);
  }

  return prisma.generationMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateSessionPointers(
  prisma: PrismaClient,
  sessionId: string,
  data: {
    latestMessageId: string;
    latestAssistantMessageId: string;
    latestInteractionId?: string | null;
  },
) {
  return prisma.generationSession.update({
    where: { id: sessionId },
    data: {
      latestMessageId: data.latestMessageId,
      latestAssistantMessageId: data.latestAssistantMessageId,
      ...(data.latestInteractionId !== undefined
        ? { latestInteractionId: data.latestInteractionId }
        : {}),
    },
  });
}
