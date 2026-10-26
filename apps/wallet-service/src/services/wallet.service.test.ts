import { randomUUID } from "node:crypto";
import { AppError } from "@platform/errors";
import { describe, expect, it } from "vitest";
import { getTestPrisma } from "../test/setup.js";
import {
  captureCoins,
  releaseCoins,
  reserveCoins,
} from "./wallet.service.js";

describe("wallet.service billing", () => {
  it("reserves coins: balance → reserved", async () => {
    const prisma = getTestPrisma();
    const userId = randomUUID();
    const jobId = randomUUID();

    await prisma.wallet.create({
      data: { userId, balanceCoins: 20, reservedCoins: 0 },
    });

    const result = await reserveCoins(prisma, {
      userId,
      jobId,
      amount: 5,
    });

    expect(result).toMatchObject({
      jobId,
      amount: 5,
      balanceCoins: 15,
      reservedCoins: 5,
      idempotent: false,
    });

    const again = await reserveCoins(prisma, {
      userId,
      jobId,
      amount: 5,
    });
    expect(again.idempotent).toBe(true);
    expect(again.balanceCoins).toBe(15);
    expect(again.reservedCoins).toBe(5);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceCoins).toBe(15);
    expect(wallet.reservedCoins).toBe(5);
  });

  it("rejects reserve when balance is too low", async () => {
    const prisma = getTestPrisma();
    const userId = randomUUID();
    const jobId = randomUUID();

    await prisma.wallet.create({
      data: { userId, balanceCoins: 2, reservedCoins: 0 },
    });

    await expect(
      reserveCoins(prisma, { userId, jobId, amount: 5 }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
      statusCode: 402,
    } satisfies Partial<AppError>);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceCoins).toBe(2);
    expect(wallet.reservedCoins).toBe(0);
  });

  it("captures once; second capture is idempotent", async () => {
    const prisma = getTestPrisma();
    const userId = randomUUID();
    const jobId = randomUUID();

    await prisma.wallet.create({
      data: { userId, balanceCoins: 10, reservedCoins: 0 },
    });
    await reserveCoins(prisma, { userId, jobId, amount: 5 });

    const first = await captureCoins(prisma, { userId, jobId });
    expect(first).toEqual({ jobId, amount: 5, idempotent: false });

    const second = await captureCoins(prisma, { userId, jobId });
    expect(second).toEqual({ jobId, amount: 5, idempotent: true });

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceCoins).toBe(5);
    expect(wallet.reservedCoins).toBe(0);

    const captures = await prisma.transaction.findMany({
      where: { userId, type: "capture" },
    });
    expect(captures).toHaveLength(1);
  });

  it("releases reserved coins back to balance", async () => {
    const prisma = getTestPrisma();
    const userId = randomUUID();
    const jobId = randomUUID();

    await prisma.wallet.create({
      data: { userId, balanceCoins: 10, reservedCoins: 0 },
    });
    await reserveCoins(prisma, { userId, jobId, amount: 5 });

    const released = await releaseCoins(prisma, { userId, jobId });
    expect(released).toEqual({ jobId, amount: 5, idempotent: false });

    const again = await releaseCoins(prisma, { userId, jobId });
    expect(again.idempotent).toBe(true);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceCoins).toBe(10);
    expect(wallet.reservedCoins).toBe(0);
  });

  it("rejects capture after release and release after capture", async () => {
    const prisma = getTestPrisma();
    const userA = randomUUID();
    const userB = randomUUID();
    const jobReleased = randomUUID();
    const jobCaptured = randomUUID();

    await prisma.wallet.create({
      data: { userId: userA, balanceCoins: 20, reservedCoins: 0 },
    });
    await prisma.wallet.create({
      data: { userId: userB, balanceCoins: 20, reservedCoins: 0 },
    });

    await reserveCoins(prisma, { userId: userA, jobId: jobReleased, amount: 5 });
    await releaseCoins(prisma, { userId: userA, jobId: jobReleased });
    await expect(
      captureCoins(prisma, { userId: userA, jobId: jobReleased }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });

    await reserveCoins(prisma, { userId: userB, jobId: jobCaptured, amount: 5 });
    await captureCoins(prisma, { userId: userB, jobId: jobCaptured });
    await expect(
      releaseCoins(prisma, { userId: userB, jobId: jobCaptured }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
  });

  it("release with no reserve is a no-op", async () => {
    const prisma = getTestPrisma();
    const result = await releaseCoins(prisma, {
      userId: randomUUID(),
      jobId: randomUUID(),
    });
    expect(result).toEqual({
      jobId: expect.any(String),
      amount: 0,
      idempotent: true,
    });
  });
});
