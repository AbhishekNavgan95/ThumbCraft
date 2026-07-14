import { AppError } from "@platform/errors";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  createCategory,
  deleteCategory,
  findCategoryById,
  listActiveCategories,
  listAllCategories,
  toPublicCategory,
  updateCategory,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "./category.service.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertUuid(id: string, field = "categoryId"): void {
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

function assertSlug(value: unknown): string {
  const slug = assertNonEmptyString(value, "slug").toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "slug must be lowercase alphanumeric with hyphens (e.g. gaming-tech)",
      422,
    );
  }
  return slug;
}

function parseCreateInput(body: Record<string, unknown>): CreateCategoryInput {
  const slug = assertSlug(body.slug);
  const name = assertNonEmptyString(body.name, "name");

  let description: string | null | undefined;
  if (body.description !== undefined) {
    if (body.description === null) {
      description = null;
    } else if (typeof body.description === "string") {
      description = body.description.trim() || null;
    } else {
      throw new AppError(
        "VALIDATION_ERROR",
        "description must be a string or null",
        422,
      );
    }
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

  let active: boolean | undefined;
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      throw new AppError("VALIDATION_ERROR", "active must be a boolean", 422);
    }
    active = body.active;
  }

  return { slug, name, description, sortOrder, active };
}

function parseUpdateInput(body: Record<string, unknown>): UpdateCategoryInput {
  const input: UpdateCategoryInput = {};

  if (body.slug !== undefined) {
    input.slug = assertSlug(body.slug);
  }
  if (body.name !== undefined) {
    input.name = assertNonEmptyString(body.name, "name");
  }
  if (body.description !== undefined) {
    if (body.description === null) {
      input.description = null;
    } else if (typeof body.description === "string") {
      input.description = body.description.trim() || null;
    } else {
      throw new AppError(
        "VALIDATION_ERROR",
        "description must be a string or null",
        422,
      );
    }
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

export async function listCategoriesForCustomer(prisma: PrismaClient) {
  const categories = await listActiveCategories(prisma);
  return { categories: categories.map(toPublicCategory) };
}

export async function listCategoriesForAdmin(prisma: PrismaClient) {
  const categories = await listAllCategories(prisma);
  return { categories: categories.map(toPublicCategory) };
}

export async function getCategoryForCustomer(
  prisma: PrismaClient,
  categoryId: string,
) {
  assertUuid(categoryId);
  const category = await findCategoryById(prisma, categoryId);
  if (!category || !category.active) {
    throw new AppError("NOT_FOUND", "Template category not found", 404);
  }
  return { category: toPublicCategory(category) };
}

export async function getCategoryForAdmin(
  prisma: PrismaClient,
  categoryId: string,
) {
  assertUuid(categoryId);
  const category = await findCategoryById(prisma, categoryId);
  if (!category) {
    throw new AppError("NOT_FOUND", "Template category not found", 404);
  }
  return { category: toPublicCategory(category) };
}

export async function createTemplateCategory(
  prisma: PrismaClient,
  body: Record<string, unknown>,
) {
  const input = parseCreateInput(body);
  const category = await createCategory(prisma, input);
  return { category: toPublicCategory(category) };
}

export async function patchTemplateCategory(
  prisma: PrismaClient,
  categoryId: string,
  body: Record<string, unknown>,
) {
  assertUuid(categoryId);
  const input = parseUpdateInput(body);
  const category = await updateCategory(prisma, categoryId, input);
  return { category: toPublicCategory(category) };
}

export async function removeTemplateCategory(
  prisma: PrismaClient,
  categoryId: string,
) {
  assertUuid(categoryId);
  const category = await deleteCategory(prisma, categoryId);
  return { category: toPublicCategory(category) };
}
