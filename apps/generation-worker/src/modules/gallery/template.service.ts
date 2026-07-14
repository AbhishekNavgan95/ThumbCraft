import { AppError } from "@platform/errors";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ThumbnailTemplateUpdateInput } from "../../generated/prisma/models.js";
import { findCategoryById, findCategoryBySlug } from "./category.service.js";

export interface CreateTemplateInput {
  categoryId: string;
  title: string;
  description?: string | null;
  imageUrl: string;
  previewUrl?: string | null;
  aspectRatio?: string | null;
  tags?: string[];
  sortOrder?: number;
  active?: boolean;
  createdBy?: string | null;
}

export interface UpdateTemplateInput {
  categoryId?: string;
  title?: string;
  description?: string | null;
  imageUrl?: string;
  previewUrl?: string | null;
  aspectRatio?: string | null;
  tags?: string[];
  sortOrder?: number;
  active?: boolean;
}

const categorySelect = {
  id: true,
  slug: true,
  name: true,
  active: true,
} as const;

export function toPublicTemplate(template: {
  id: string;
  categoryId: string;
  title: string;
  description: string | null;
  imageUrl: string;
  previewUrl: string | null;
  aspectRatio: string | null;
  tags: string[];
  sortOrder: number;
  active: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  category?: { id: string; slug: string; name: string; active?: boolean };
}) {
  return {
    id: template.id,
    categoryId: template.categoryId,
    title: template.title,
    description: template.description,
    imageUrl: template.imageUrl,
    previewUrl: template.previewUrl,
    aspectRatio: template.aspectRatio,
    tags: template.tags,
    sortOrder: template.sortOrder,
    active: template.active,
    createdBy: template.createdBy,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    category: template.category
      ? {
          id: template.category.id,
          slug: template.category.slug,
          name: template.category.name,
        }
      : undefined,
  };
}

async function resolveCategoryId(
  prisma: PrismaClient,
  categoryId: string,
): Promise<string> {
  const category = await findCategoryById(prisma, categoryId);
  if (!category) {
    throw new AppError("NOT_FOUND", "Template category not found", 404);
  }
  return category.id;
}

export async function listActiveTemplates(
  prisma: PrismaClient,
  categorySlug?: string,
) {
  let categoryId: string | undefined;
  if (categorySlug) {
    const category = await findCategoryBySlug(prisma, categorySlug);
    if (!category || !category.active) {
      return [];
    }
    categoryId = category.id;
  }

  return prisma.thumbnailTemplate.findMany({
    where: {
      active: true,
      ...(categoryId ? { categoryId } : {}),
      category: { active: true },
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { category: { select: categorySelect } },
  });
}

export async function listAllTemplates(
  prisma: PrismaClient,
  categorySlug?: string,
) {
  let categoryId: string | undefined;
  if (categorySlug) {
    const category = await findCategoryBySlug(prisma, categorySlug);
    if (!category) {
      return [];
    }
    categoryId = category.id;
  }

  return prisma.thumbnailTemplate.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { category: { select: categorySelect } },
  });
}

export async function findTemplateById(prisma: PrismaClient, templateId: string) {
  return prisma.thumbnailTemplate.findUnique({
    where: { id: templateId },
    include: { category: { select: categorySelect } },
  });
}

export async function createTemplate(
  prisma: PrismaClient,
  input: CreateTemplateInput,
) {
  await resolveCategoryId(prisma, input.categoryId);

  return prisma.thumbnailTemplate.create({
    data: {
      categoryId: input.categoryId,
      title: input.title,
      description: input.description ?? null,
      imageUrl: input.imageUrl,
      previewUrl: input.previewUrl ?? null,
      aspectRatio: input.aspectRatio ?? null,
      tags: input.tags ?? [],
      sortOrder: input.sortOrder ?? 0,
      active: input.active ?? true,
      createdBy: input.createdBy ?? null,
    },
    include: { category: { select: categorySelect } },
  });
}

export async function updateTemplate(
  prisma: PrismaClient,
  templateId: string,
  input: UpdateTemplateInput,
) {
  const existing = await findTemplateById(prisma, templateId);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Thumbnail template not found", 404);
  }

  if (input.categoryId !== undefined) {
    await resolveCategoryId(prisma, input.categoryId);
  }

  const data: ThumbnailTemplateUpdateInput = {
    ...(input.categoryId !== undefined
      ? { category: { connect: { id: input.categoryId } } }
      : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    ...(input.previewUrl !== undefined ? { previewUrl: input.previewUrl } : {}),
    ...(input.aspectRatio !== undefined
      ? { aspectRatio: input.aspectRatio }
      : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
  };

  return prisma.thumbnailTemplate.update({
    where: { id: templateId },
    data,
    include: { category: { select: categorySelect } },
  });
}

export async function deleteTemplate(prisma: PrismaClient, templateId: string) {
  const existing = await findTemplateById(prisma, templateId);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Thumbnail template not found", 404);
  }

  await prisma.thumbnailTemplate.delete({ where: { id: templateId } });
  return existing;
}
