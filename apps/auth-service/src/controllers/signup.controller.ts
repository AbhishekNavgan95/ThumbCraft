import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { AppError } from "@platform/errors";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import {
  RoutingKeys,
  type AuthOtpRequestedPayload,
  type PlatformEvent,
} from "@platform/messaging-contract";
import type { AuthServiceConfig } from "../config.js";
import { createOtp, generateOtpCode } from "../services/otp.service.js";
import { createPendingUser } from "../services/user.service.js";

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface SignupResult {
  message: string;
  email: string;
}

export async function signup(
  prisma: PrismaClient,
  rabbitmq: RabbitMQClient,
  config: AuthServiceConfig,
  input: SignupInput,
  correlationId: string,
): Promise<SignupResult> {

  const user = await createPendingUser(prisma, input);
  const otp = generateOtpCode();
  const expiresAt = await createOtp(prisma, user.id, otp, config.OTP_TTL_MINUTES);

  const event: PlatformEvent<AuthOtpRequestedPayload> = {
    eventId: randomUUID(),
    correlationId,
    timestamp: new Date().toISOString(),
    userId: user.id,
    payload: {
      email: user.email,
      name: user.name,
      otp,
      expiresAt: expiresAt.toISOString(),
    },
  };

  await rabbitmq.publish(RoutingKeys.AUTH_OTP_REQUESTED, event);

  return {
    message: "Verification OTP sent. Please check your email.",
    email: user.email,
  };
}

export function validateSignupInput(input: SignupInput): void {
  if (!input.name || input.name.trim().length < 2) {
    throw new AppError("VALIDATION_ERROR", "Name must be at least 2 characters", 422);
  }

  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new AppError("VALIDATION_ERROR", "A valid email address is required", 422);
  }

  if (!input.password || input.password.length < 6) {
    throw new AppError("VALIDATION_ERROR", "Password must be at least 6 characters", 422);
  }
}
