import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.js";

export async function seedVisibleModel(prisma: PrismaClient) {
  return prisma.generationModel.create({
    data: {
      provider: "gemini",
      providerModelId: `test-model-${randomUUID()}`,
      title: "Test Model",
      description: "For Vitest",
      supportedAspectRatios: ["16:9", "1:1"],
      supportedResolutions: ["1K", "2K"],
      visible: true,
      sortOrder: 0,
    },
  });
}

export function testUser(overrides?: Partial<{
  userId: string;
  email: string;
  name: string;
  role: string;
  correlationId: string;
}>) {
  return {
    userId: overrides?.userId ?? randomUUID(),
    email: overrides?.email ?? "tester@example.com",
    name: overrides?.name ?? "Tester",
    role: overrides?.role ?? "customer",
    correlationId: overrides?.correlationId ?? randomUUID(),
  };
}

export function generateBody(modelId: string) {
  return {
    originalPrompt: "Bright gaming thumbnail with neon title",
    modelId,
    requiredAspectRatio: "16:9",
    requiredResolution: "1K",
  };
}
