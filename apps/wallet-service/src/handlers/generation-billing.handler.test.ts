import { randomUUID } from "node:crypto";
import { createLogger } from "@platform/logger";
import type {
  GenerationCompletedPayload,
  GenerationFailedPayload,
  PlatformEvent,
} from "@platform/messaging-contract";
import { describe, expect, it } from "vitest";
import { getTestPrisma } from "../test/setup.js";
import { reserveCoins } from "../services/wallet.service.js";
import {
  handleGenerationCompleted,
  handleGenerationFailed,
} from "./generation-billing.handler.js";

const logger = createLogger({ service: "wallet-test", level: "fatal" });

describe("generation billing handlers", () => {
  it("captures on generation.completed", async () => {
    const prisma = getTestPrisma();
    const userId = randomUUID();
    const jobId = randomUUID();

    await prisma.wallet.create({
      data: { userId, balanceCoins: 10, reservedCoins: 0 },
    });
    await reserveCoins(prisma, { userId, jobId, amount: 5 });

    const event: PlatformEvent<GenerationCompletedPayload> = {
      eventId: randomUUID(),
      correlationId: randomUUID(),
      timestamp: new Date().toISOString(),
      userId,
      jobId,
      payload: {
        kind: "generation",
        imageUrls: ["https://example.com/t.png"],
      },
    };

    await handleGenerationCompleted(event, prisma, logger);
    await handleGenerationCompleted(event, prisma, logger);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceCoins).toBe(5);
    expect(wallet.reservedCoins).toBe(0);
  });

  it("releases on generation.failed", async () => {
    const prisma = getTestPrisma();
    const userId = randomUUID();
    const jobId = randomUUID();

    await prisma.wallet.create({
      data: { userId, balanceCoins: 10, reservedCoins: 0 },
    });
    await reserveCoins(prisma, { userId, jobId, amount: 5 });

    const event: PlatformEvent<GenerationFailedPayload> = {
      eventId: randomUUID(),
      correlationId: randomUUID(),
      timestamp: new Date().toISOString(),
      userId,
      jobId,
      payload: {
        kind: "generation",
        error: "provider timeout",
      },
    };

    await handleGenerationFailed(event, prisma, logger);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceCoins).toBe(10);
    expect(wallet.reservedCoins).toBe(0);
  });
});
