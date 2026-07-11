import type { PrismaClient } from "@prisma/client";
import { AppError } from "@platform/errors";
import { hashPassword, verifyPassword } from "./password.service.js";
import type { PublicUser } from "../types.js";

function toPublicUser(user: { id: string; email: string; name: string }): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

export async function findUserByEmail(prisma: PrismaClient, email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
}

export async function findUserById(prisma: PrismaClient, id: string) {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function createPendingUser(
  prisma: PrismaClient,
  input: { name: string; email: string; password: string },
): Promise<PublicUser> {
  const email = input.email.toLowerCase().trim();
  const existing = await findUserByEmail(prisma, email);
  if (existing) {
    throw new AppError(
      "CONFLICT",
      "An account with this email already exists",
      409,
      { suggestion: "Please try logging in instead, or use a different email address." },
    );
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash,
    },
  });

  return toPublicUser(user);
}

export async function markUserVerified(prisma: PrismaClient, userId: string): Promise<PublicUser> {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });

    return toPublicUser(user);
  } catch {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }
}

export async function authenticateUser(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<PublicUser> {
  const user = await findUserByEmail(prisma, email);
  if (!user) {
    throw new AppError(
      "UNAUTHORIZED",
      "No account found with this email address",
      401,
      { suggestion: "Please check your email address or create a new account." },
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError(
      "UNAUTHORIZED",
      "Incorrect password",
      401,
      { suggestion: "Please check your password and try again." },
    );
  }

  if (!user.emailVerifiedAt) {
    throw new AppError(
      "FORBIDDEN",
      "Email address is not verified",
      403,
      { suggestion: "Please verify your email with the OTP sent during signup." },
    );
  }

  return toPublicUser(user);
}

export { toPublicUser };
