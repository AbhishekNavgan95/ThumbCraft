import { AppError } from "@platform/errors";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  createTemplate,
  deleteTemplate,
  findTemplateById,
  listActiveTemplates,
  listAllTemplates,
  toPublicTemplate,
  updateTemplate,
  type CreateTemplateInput,
  type UpdateTemplateInput,
} from "./template.service.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertUuid(id: string, field: string): void {
  if (!UUID_RE.test(id)) {
    throw new AppError("VALIDATION_ERROR", `${field} must be a valid UUID`, 422);
  }
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", `${field} is required`, 422);
  }
  return value.trim();
}

function assertUrl(value: unknown, field: string): string {
  const url = assertNonEmptyString(value, field);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      `${field} must be a valid http(s) URL`,
      422,
    );
  }
  return url;
}

function assertOptionalUrl(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return assertUrl(value, field);
}

function assertOptionalString(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new AppError(
      "VALIDATION_ERROR",
      `${field} must be a string or null`,
      422,
    );
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertTags(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new AppError("VALIDATION_ERROR", "tags must be an array of strings", 422);
  }
  return value.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        `tags[${index}] must be a non-empty string`,
        422,
      );
    }
    return item.trim();
  });
}

function parseCategoryQuery(query: unknown): string | undefined {
  if (typeof query !== "object" || query === null) return undefined;
  const category = (query as { category?: unknown }).category;
  if (category === undefined) return undefined;
  if (typeof category !== "string" || category.trim().length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "category query must be a non-empty slug",
      422,
    );
  }
  const slug = category.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "category query must be a valid slug",
      422,
    );
  }
  return slug;
}

function parseCreateInput(
  body: Record<string, unknown>,
  createdBy: string,
): CreateTemplateInput {
  const categoryId = assertNonEmptyString(body.categoryId, "categoryId");
  assertUuid(categoryId, "categoryId");

  const title = assertNonEmptyString(body.title, "title");
  const imageUrl = assertUrl(body.imageUrl, "imageUrl");
  const description = assertOptionalString(body.description, "description");
  const previewUrl = assertOptionalUrl(body.previewUrl, "previewUrl");
  const aspectRatio = assertOptionalString(body.aspectRatio, "aspectRatio");
  const tags = assertTags(body.tags);

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

  let active: boolean | undefined;
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      throw new AppError("VALIDATION_ERROR", "active must be a boolean", 422);
    }
    active = body.active;
  }

  return {
    categoryId,
    title,
    description,
    imageUrl,
    previewUrl,
    aspectRatio,
    tags,
    sortOrder,
    active,
    createdBy,
  };
}

function parseUpdateInput(body: Record<string, unknown>): UpdateTemplateInput {
  const input: UpdateTemplateInput = {};

  if (body.categoryId !== undefined) {
    const categoryId = assertNonEmptyString(body.categoryId, "categoryId");
    assertUuid(categoryId, "categoryId");
    input.categoryId = categoryId;
  }
  if (body.title !== undefined) {
    input.title = assertNonEmptyString(body.title, "title");
  }
  if (body.description !== undefined) {
    input.description = assertOptionalString(body.description, "description");
  }
  if (body.imageUrl !== undefined) {
    input.imageUrl = assertUrl(body.imageUrl, "imageUrl");
  }
  if (body.previewUrl !== undefined) {
    input.previewUrl = assertOptionalUrl(body.previewUrl, "previewUrl");
  }
  if (body.aspectRatio !== undefined) {
    input.aspectRatio = assertOptionalString(body.aspectRatio, "aspectRatio");
  }
  if (body.tags !== undefined) {
    input.tags = assertTags(body.tags);
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
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      throw new AppError("VALIDATION_ERROR", "active must be a boolean", 422);
    }
    input.active = body.active;
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

export async function listTemplatesForCustomer(
  prisma: PrismaClient,
  query: unknown,
) {
  const categorySlug = parseCategoryQuery(query);
  const templates = await listActiveTemplates(prisma, categorySlug);
  return { templates: templates.map(toPublicTemplate) };
}

export async function listTemplatesForAdmin(
  prisma: PrismaClient,
  query: unknown,
) {
  const categorySlug = parseCategoryQuery(query);
  const templates = await listAllTemplates(prisma, categorySlug);
  return { templates: templates.map(toPublicTemplate) };
}

export async function getTemplateForCustomer(
  prisma: PrismaClient,
  templateId: string,
) {
  assertUuid(templateId, "templateId");
  const template = await findTemplateById(prisma, templateId);
  if (!template || !template.active || !template.category?.active) {
    throw new AppError("NOT_FOUND", "Thumbnail template not found", 404);
  }
  return { template: toPublicTemplate(template) };
}

export async function getTemplateForAdmin(
  prisma: PrismaClient,
  templateId: string,
) {
  assertUuid(templateId, "templateId");
  const template = await findTemplateById(prisma, templateId);
  if (!template) {
    throw new AppError("NOT_FOUND", "Thumbnail template not found", 404);
  }
  return { template: toPublicTemplate(template) };
}

export async function createThumbnailTemplate(
  prisma: PrismaClient,
  body: Record<string, unknown>,
  createdBy: string,
) {
  const input = parseCreateInput(body, createdBy);
  const template = await createTemplate(prisma, input);
  return { template: toPublicTemplate(template) };
}

export async function patchThumbnailTemplate(
  prisma: PrismaClient,
  templateId: string,
  body: Record<string, unknown>,
) {
  assertUuid(templateId, "templateId");
  const input = parseUpdateInput(body);
  const template = await updateTemplate(prisma, templateId, input);
  return { template: toPublicTemplate(template) };
}

export async function removeThumbnailTemplate(
  prisma: PrismaClient,
  templateId: string,
) {
  assertUuid(templateId, "templateId");
  const template = await deleteTemplate(prisma, templateId);
  return { template: toPublicTemplate(template) };
}
