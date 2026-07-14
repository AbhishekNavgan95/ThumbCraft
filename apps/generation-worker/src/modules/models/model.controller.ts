import { AppError } from "@platform/errors";
import type { PrismaClient, Provider } from "../../generated/prisma/client.js";
import {
  createModel,
  deleteModel,
  findModelById,
  listAllModels,
  listVisibleModels,
  toPublicModel,
  updateModel,
  type CreateModelInput,
  type UpdateModelInput,
} from "./model.service.js";

const PROVIDERS = new Set<Provider>(["gemini", "openai"]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(modelId: string): void {
  if (!UUID_RE.test(modelId)) {
    throw new AppError("VALIDATION_ERROR", "modelId must be a valid UUID", 422);
  }
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", `${field} is required`, 422);
  }
  return value.trim();
}

function assertStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${field} must be a non-empty array of strings`,
      422,
    );
  }
  const items = value.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        `${field}[${index}] must be a non-empty string`,
        422,
      );
    }
    return item.trim();
  });
  return items;
}

function assertOptionalStringArray(
  value: unknown,
  field: string,
): string[] | undefined {
  if (value === undefined) return undefined;
  return assertStringArray(value, field);
}

function assertProvider(value: unknown): Provider {
  if (typeof value !== "string" || !PROVIDERS.has(value as Provider)) {
    throw new AppError(
      "VALIDATION_ERROR",
      'provider must be "gemini" or "openai"',
      422,
    );
  }
  return value as Provider;
}

function parseCreateInput(body: Record<string, unknown>): CreateModelInput {
  const provider = assertProvider(body.provider);
  const providerModelId = assertNonEmptyString(
    body.providerModelId,
    "providerModelId",
  );
  const title = assertNonEmptyString(body.title, "title");
  const description = assertNonEmptyString(body.description, "description");
  const supportedAspectRatios = assertStringArray(
    body.supportedAspectRatios,
    "supportedAspectRatios",
  );
  const supportedResolutions = assertStringArray(
    body.supportedResolutions,
    "supportedResolutions",
  );

  let visible: boolean | undefined;
  if (body.visible !== undefined) {
    if (typeof body.visible !== "boolean") {
      throw new AppError("VALIDATION_ERROR", "visible must be a boolean", 422);
    }
    visible = body.visible;
  }

  let sortOrder: number | undefined;
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "sortOrder must be an integer",
        422,
      );
    }
    sortOrder = body.sortOrder as number;
  }

  return {
    provider,
    providerModelId,
    title,
    description,
    supportedAspectRatios,
    supportedResolutions,
    visible,
    sortOrder,
  };
}

function parseUpdateInput(body: Record<string, unknown>): UpdateModelInput {
  const input: UpdateModelInput = {};

  if (body.provider !== undefined) {
    input.provider = assertProvider(body.provider);
  }
  if (body.providerModelId !== undefined) {
    input.providerModelId = assertNonEmptyString(
      body.providerModelId,
      "providerModelId",
    );
  }
  if (body.title !== undefined) {
    input.title = assertNonEmptyString(body.title, "title");
  }
  if (body.description !== undefined) {
    input.description = assertNonEmptyString(body.description, "description");
  }
  if (body.supportedAspectRatios !== undefined) {
    input.supportedAspectRatios = assertOptionalStringArray(
      body.supportedAspectRatios,
      "supportedAspectRatios",
    );
  }
  if (body.supportedResolutions !== undefined) {
    input.supportedResolutions = assertOptionalStringArray(
      body.supportedResolutions,
      "supportedResolutions",
    );
  }
  if (body.visible !== undefined) {
    if (typeof body.visible !== "boolean") {
      throw new AppError("VALIDATION_ERROR", "visible must be a boolean", 422);
    }
    input.visible = body.visible;
  }
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "sortOrder must be an integer",
        422,
      );
    }
    input.sortOrder = body.sortOrder as number;
  }

  if (Object.keys(input).length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Provide at least one field to update",
      422,
    );
  }

  return input;
}

export async function listModelsForCustomer(prisma: PrismaClient) {
  const models = await listVisibleModels(prisma);
  return { models: models.map(toPublicModel) };
}

export async function listModelsForAdmin(prisma: PrismaClient) {
  const models = await listAllModels(prisma);
  return { models: models.map(toPublicModel) };
}

export async function getModelForCustomer(prisma: PrismaClient, modelId: string) {
  assertUuid(modelId);
  const model = await findModelById(prisma, modelId);
  if (!model || !model.visible) {
    throw new AppError("NOT_FOUND", "Generation model not found", 404);
  }
  return { model: toPublicModel(model) };
}

export async function getModelForAdmin(prisma: PrismaClient, modelId: string) {
  assertUuid(modelId);
  const model = await findModelById(prisma, modelId);
  if (!model) {
    throw new AppError("NOT_FOUND", "Generation model not found", 404);
  }
  return { model: toPublicModel(model) };
}

export async function createGenerationModel(
  prisma: PrismaClient,
  body: Record<string, unknown>,
) {
  const input = parseCreateInput(body);
  const model = await createModel(prisma, input);
  return { model: toPublicModel(model) };
}

export async function patchGenerationModel(
  prisma: PrismaClient,
  modelId: string,
  body: Record<string, unknown>,
) {
  assertUuid(modelId);
  const input = parseUpdateInput(body);
  const model = await updateModel(prisma, modelId, input);
  return { model: toPublicModel(model) };
}

export async function removeGenerationModel(
  prisma: PrismaClient,
  modelId: string,
) {
  assertUuid(modelId);
  const model = await deleteModel(prisma, modelId);
  return { model: toPublicModel(model) };
}
