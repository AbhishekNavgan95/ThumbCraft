import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "@platform/errors";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import {
  RoutingKeys,
  type PlatformEvent,
  type UserRegisteredPayload,
} from "@platform/messaging-contract";
import type { AuthServiceConfig } from "../config.js";
import { createToken } from "../services/token.service.js";
import { createVerifiedAdmin } from "../services/user.service.js";
import type { PublicUser } from "../types.js";

export interface AdminRegisterInput {
  name: string;
  email: string;
  password: string;
  inviteSecret: string;
}

export interface AdminRegisterResult {
  token: string;
  user: PublicUser;
  message: string;
}

export async function registerAdmin(
  prisma: PrismaClient,
  rabbitmq: RabbitMQClient,
  config: AuthServiceConfig,
  input: AdminRegisterInput,
  correlationId: string,
): Promise<AdminRegisterResult> {
  if (input.inviteSecret !== config.ADMIN_INVITE_SECRET) {
    throw new AppError("FORBIDDEN", "Invalid admin invite secret", 403);
  }

  const user = await createVerifiedAdmin(prisma, {
    name: input.name,
    email: input.email,
    password: input.password,
  });
  const token = createToken(config, user);

  const event: PlatformEvent<UserRegisteredPayload> = {
    eventId: randomUUID(),
    correlationId,
    timestamp: new Date().toISOString(),
    userId: user.id,
    payload: {
      email: user.email,
      name: user.name,
    },
  };

  await rabbitmq.publish(RoutingKeys.USER_REGISTERED, event);

  return {
    token,
    user,
    message: "Admin account created successfully.",
  };
}

export function validateAdminRegisterInput(input: AdminRegisterInput): void {
  if (!input.name || input.name.trim().length < 2) {
    throw new AppError("VALIDATION_ERROR", "Name must be at least 2 characters", 422);
  }

  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new AppError("VALIDATION_ERROR", "A valid email address is required", 422);
  }

  if (!input.password || input.password.length < 6) {
    throw new AppError("VALIDATION_ERROR", "Password must be at least 6 characters", 422);
  }

  if (!input.inviteSecret) {
    throw new AppError("VALIDATION_ERROR", "Invite secret is required", 422);
  }
}
