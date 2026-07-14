import { AppError } from "@platform/errors";
import type { Prisma, PrismaClient, Provider } from "../../generated/prisma/client.js";

export interface CreateModelInput {
  provider: Provider;
  providerModelId: string;
  title: string;
  description: string;
  supportedAspectRatios: string[];
  supportedResolutions: string[];
  visible?: boolean;
  sortOrder?: number;
}

export interface UpdateModelInput {
  provider?: Provider;
  providerModelId?: string;
  title?: string;
  description?: string;
  supportedAspectRatios?: string[];
  supportedResolutions?: string[];
  visible?: boolean;
  sortOrder?: number;
}

function isPrismaError(
  error: unknown,
): error is { code: string; meta?: { target?: string[] } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

export function toPublicModel(model: {
  id: string;
  provider: Provider;
  providerModelId: string;
  title: string;
  description: string;
  supportedAspectRatios: string[];
  supportedResolutions: string[];
  visible: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: model.id,
    provider: model.provider,
    providerModelId: model.providerModelId,
    title: model.title,
    description: model.description,
    supportedAspectRatios: model.supportedAspectRatios,
    supportedResolutions: model.supportedResolutions,
    visible: model.visible,
    sortOrder: model.sortOrder,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  };
}

export async function listVisibleModels(prisma: PrismaClient) {
  return prisma.generationModel.findMany({
    where: { visible: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

export async function listAllModels(prisma: PrismaClient) {
  return prisma.generationModel.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

export async function findModelById(prisma: PrismaClient, modelId: string) {
  return prisma.generationModel.findUnique({ where: { id: modelId } });
}

export async function createModel(prisma: PrismaClient, input: CreateModelInput) {
  try {
    return await prisma.generationModel.create({
      data: {
        provider: input.provider,
        providerModelId: input.providerModelId,
        title: input.title,
        description: input.description,
        supportedAspectRatios: input.supportedAspectRatios,
        supportedResolutions: input.supportedResolutions,
        visible: input.visible ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  } catch (error) {
    if (isPrismaError(error) && error.code === "P2002") {
      throw new AppError(
        "CONFLICT",
        "A model with this providerModelId already exists",
        409,
      );
    }
    throw error;
  }
}

export async function updateModel(
  prisma: PrismaClient,
  modelId: string,
  input: UpdateModelInput,
) {
  const existing = await findModelById(prisma, modelId);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Generation model not found", 404);
  }

  const data: Prisma.GenerationModelUpdateInput = {
    ...(input.provider !== undefined ? { provider: input.provider } : {}),
    ...(input.providerModelId !== undefined
      ? { providerModelId: input.providerModelId }
      : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.supportedAspectRatios !== undefined
      ? { supportedAspectRatios: input.supportedAspectRatios }
      : {}),
    ...(input.supportedResolutions !== undefined
      ? { supportedResolutions: input.supportedResolutions }
      : {}),
    ...(input.visible !== undefined ? { visible: input.visible } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };

  try {
    return await prisma.generationModel.update({
      where: { id: modelId },
      data,
    });
  } catch (error) {
    if (isPrismaError(error) && error.code === "P2002") {
      throw new AppError(
        "CONFLICT",
        "A model with this providerModelId already exists",
        409,
      );
    }
    throw error;
  }
}

export async function deleteModel(prisma: PrismaClient, modelId: string) {
  const existing = await findModelById(prisma, modelId);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Generation model not found", 404);
  }

  try {
    await prisma.generationModel.delete({ where: { id: modelId } });
  } catch (error) {
    if (isPrismaError(error) && error.code === "P2003") {
      throw new AppError(
        "CONFLICT",
        "Cannot delete model that is referenced by generation messages. Hide it with visible=false instead.",
        409,
      );
    }
    throw error;
  }

  return existing;
}
