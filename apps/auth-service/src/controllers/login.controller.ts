import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "@platform/errors";
import { authenticateUser } from "../services/user.service.js";
import { createToken } from "../services/token.service.js";
import type { AuthServiceConfig } from "../config.js";
import type { PublicUser } from "../types.js";

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: PublicUser;
  message: string;
}

export async function login(
  prisma: PrismaClient,
  config: AuthServiceConfig,
  input: LoginInput,
): Promise<LoginResult> {
  const user = await authenticateUser(prisma, input.email, input.password);
  const token = createToken(config, user);

  return {
    token,
    user,
    message: `Welcome back, ${user.name}! Login successful.`,
  };
}

export function validateLoginInput(input: LoginInput): void {
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new AppError("VALIDATION_ERROR", "A valid email address is required", 422);
  }

  if (!input.password) {
    throw new AppError("VALIDATION_ERROR", "Password is required", 422);
  }
}
