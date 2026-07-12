import { randomInt } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.js";
import { hashOtp, verifyOtp } from "./password.service.js";

export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function createOtp(
  prisma: PrismaClient,
  userId: string,
  otp: string,
  ttlMinutes: number,
): Promise<Date> {
  const codeHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.otpCode.create({
    data: {
      userId,
      codeHash,
      expiresAt,
    },
  });

  return expiresAt;
}

export async function findActiveOtp(prisma: PrismaClient, userId: string) {
  return prisma.otpCode.findFirst({
    where: {
      userId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function verifyUserOtp(
  prisma: PrismaClient,
  userId: string,
  otp: string,
): Promise<boolean> {
  const record = await findActiveOtp(prisma, userId);
  if (!record) {
    return false;
  }

  const valid = await verifyOtp(otp, record.codeHash);
  if (!valid) {
    return false;
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return true;
}
