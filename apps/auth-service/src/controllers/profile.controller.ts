import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "@platform/errors";
import { findUserById, toPublicUser } from "../services/user.service.js";
import type { PublicUser } from "../types.js";

export async function getProfile(
  prisma: PrismaClient,
  userId: string,
): Promise<{ user: PublicUser }> {
  const user = await findUserById(prisma, userId);
  if (!user) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }

  return { user: toPublicUser(user) };
}
