import { AppError } from "@platform/errors";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export interface CreateCategoryInput {
  slug: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export interface UpdateCategoryInput {
  slug?: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
  active?: boolean;
}

function isPrismaError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

export function toPublicCategory(category: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { templates: number };
}) {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
    active: category.active,
    templateCount: category._count?.templates,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export async function listActiveCategories(prisma: PrismaClient) {
  return prisma.templateCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { templates: true } } },
  });
}

export async function listAllCategories(prisma: PrismaClient) {
  return prisma.templateCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { templates: true } } },
  });
}

export async function findCategoryById(prisma: PrismaClient, categoryId: string) {
  return prisma.templateCategory.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { templates: true } } },
  });
}

export async function findCategoryBySlug(prisma: PrismaClient, slug: string) {
  return prisma.templateCategory.findUnique({ where: { slug } });
}

export async function createCategory(
  prisma: PrismaClient,
  input: CreateCategoryInput,
) {
  try {
    return await prisma.templateCategory.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
      },
      include: { _count: { select: { templates: true } } },
    });
  } catch (error) {
    if (isPrismaError(error) && error.code === "P2002") {
      throw new AppError(
        "CONFLICT",
        "A category with this slug already exists",
        409,
      );
    }
    throw error;
  }
}

export async function updateCategory(
  prisma: PrismaClient,
  categoryId: string,
  input: UpdateCategoryInput,
) {
  const existing = await findCategoryById(prisma, categoryId);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Template category not found", 404);
  }

  const data: Prisma.TemplateCategoryUpdateInput = {
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
  };

  try {
    return await prisma.templateCategory.update({
      where: { id: categoryId },
      data,
      include: { _count: { select: { templates: true } } },
    });
  } catch (error) {
    if (isPrismaError(error) && error.code === "P2002") {
      throw new AppError(
        "CONFLICT",
        "A category with this slug already exists",
        409,
      );
    }
    throw error;
  }
}

export async function deleteCategory(prisma: PrismaClient, categoryId: string) {
  const existing = await findCategoryById(prisma, categoryId);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Template category not found", 404);
  }

  await prisma.templateCategory.delete({ where: { id: categoryId } });
  return existing;
}
