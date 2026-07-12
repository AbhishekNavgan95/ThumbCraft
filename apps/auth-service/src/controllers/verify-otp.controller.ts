import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "@platform/errors";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import {
  RoutingKeys,
  type PlatformEvent,
  type UserRegisteredPayload,
} from "@platform/messaging-contract";
import { verifyUserOtp } from "../services/otp.service.js";
import { createToken } from "../services/token.service.js";
import { findUserByEmail, markUserVerified } from "../services/user.service.js";
import type { AuthServiceConfig } from "../config.js";
import type { PublicUser } from "../types.js";

export interface VerifyOtpInput {
  email: string;
  otp: string;
}

export interface VerifyOtpResult {
  token: string;
  user: PublicUser;
  message: string;
}

export async function verifyOtp(
  prisma: PrismaClient,
  rabbitmq: RabbitMQClient,
  config: AuthServiceConfig,
  input: VerifyOtpInput,
  correlationId: string,
): Promise<VerifyOtpResult> {
  const user = await findUserByEmail(prisma, input.email);
  if (!user) {
    throw new AppError("NOT_FOUND", "No account found with this email address", 404);
  }

  if (user.emailVerifiedAt) {
    throw new AppError("CONFLICT", "Email address is already verified", 409);
  }

  const valid = await verifyUserOtp(prisma, user.id, input.otp);
  if (!valid) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired OTP", 401);
  }

  const verifiedUser = await markUserVerified(prisma, user.id);
  const token = createToken(config, verifiedUser);

  const event: PlatformEvent<UserRegisteredPayload> = {
    eventId: randomUUID(),
    correlationId,
    timestamp: new Date().toISOString(),
    userId: verifiedUser.id,
    payload: {
      email: verifiedUser.email,
      name: verifiedUser.name,
    },
  };

  await rabbitmq.publish(RoutingKeys.USER_REGISTERED, event);

  return {
    token,
    user: verifiedUser,
    message: "Email verified successfully! Welcome to AI Thumbnail Generator!",
  };
}

export function validateVerifyOtpInput(input: VerifyOtpInput): void {
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new AppError("VALIDATION_ERROR", "A valid email address is required", 422);
  }

  if (!input.otp || !/^\d{6}$/.test(input.otp)) {
    throw new AppError("VALIDATION_ERROR", "OTP must be a 6-digit code", 422);
  }
}
