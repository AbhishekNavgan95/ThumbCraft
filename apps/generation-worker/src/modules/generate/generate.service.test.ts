import { randomUUID } from "node:crypto";
import { AppError } from "@platform/errors";
import { describe, expect, it } from "vitest";
import { RoutingKeys } from "@platform/messaging-contract";
import { GenerateService } from "./generate.service.js";
import { createSilentLogger, createFakeQueue, createFakeRabbitmq, createFakeWallet } from "../../test/fakes.js";
import { generateBody, seedVisibleModel, testUser } from "../../test/fixtures.js";
import { getTestPrisma } from "../../test/setup.js";

describe("GenerateService", () => {
  it("happy path: messages, reserve, enqueue, processing job", async () => {
    const prisma = getTestPrisma();
    const model = await seedVisibleModel(prisma);
    const fakeQueue = createFakeQueue();
    const fakeWallet = createFakeWallet({ coinCost: 5 });
    const fakeRabbit = createFakeRabbitmq();
    const user = testUser();

    const service = new GenerateService({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      wallet: fakeWallet.wallet,
      logger: createSilentLogger(),
      storage: null,
      fakeImageGeneration: true,
      generationQueue: fakeQueue.queue,
    });

    const result = await service.generate({
      user,
      body: generateBody(model.id),
      correlationId: user.correlationId!,
      idempotencyKey: `test-happy-${randomUUID()}`,
    });

    expect(result.job.status).toBe("processing");
    expect(result.job.coinCost).toBe(5);
    expect(result.job.billing).toBe("reserved_then_capture_via_event");
    expect(result.userMessage.role).toBe("user");
    expect(result.assistantMessage.role).toBe("assistant");
    expect(result.assistantMessage.status).toBe("processing");
    expect(fakeWallet.reserves).toHaveLength(1);
    expect(fakeWallet.reserves[0]?.jobId).toBe(result.job.id);
    expect(fakeQueue.enqueued).toHaveLength(1);
    expect(fakeQueue.enqueued[0]?.payload.jobId).toBe(result.job.id);
  });

  it("idempotency: same key does not create a second job or reserve", async () => {
    const prisma = getTestPrisma();
    const model = await seedVisibleModel(prisma);
    const fakeQueue = createFakeQueue();
    const fakeWallet = createFakeWallet();
    const fakeRabbit = createFakeRabbitmq();
    const user = testUser();
    const idempotencyKey = `idem-${randomUUID()}`;

    const service = new GenerateService({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      wallet: fakeWallet.wallet,
      logger: createSilentLogger(),
      storage: null,
      fakeImageGeneration: true,
      generationQueue: fakeQueue.queue,
    });

    await service.generate({
      user,
      body: generateBody(model.id),
      correlationId: user.correlationId!,
      idempotencyKey,
    });

    await expect(
      service.generate({
        user,
        body: generateBody(model.id),
        correlationId: user.correlationId!,
        idempotencyKey,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      statusCode: 409,
    });

    expect(fakeWallet.reserves).toHaveLength(1);
    expect(fakeQueue.enqueued).toHaveLength(1);

    const jobs = await prisma.generationJob.findMany({
      where: { idempotencyKey },
    });
    expect(jobs).toHaveLength(1);
  });

  it("not enough coins: marks job failed and does not enqueue", async () => {
    const prisma = getTestPrisma();
    const model = await seedVisibleModel(prisma);
    const fakeQueue = createFakeQueue();
    const fakeRabbit = createFakeRabbitmq();
    const user = testUser();

    const service = new GenerateService({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      wallet: createFakeWallet({
        reserveError: new AppError(
          "INSUFFICIENT_FUNDS",
          "Insufficient coin balance",
          402,
        ),
      }).wallet,
      logger: createSilentLogger(),
      storage: null,
      fakeImageGeneration: true,
      generationQueue: fakeQueue.queue,
    });

    await expect(
      service.generate({
        user,
        body: generateBody(model.id),
        correlationId: user.correlationId!,
        idempotencyKey: `nofunds-${randomUUID()}`,
      }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
      statusCode: 402,
    });

    expect(fakeQueue.enqueued).toHaveLength(0);

    const jobs = await prisma.generationJob.findMany({
      where: { userId: user.userId },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("failed");

    const assistants = await prisma.generationMessage.findMany({
      where: { sessionId: jobs[0]!.sessionId!, role: "assistant" },
    });
    expect(assistants[0]?.status).toBe("failed");
  });

  it("fake worker success publishes generation.completed and captures job", async () => {
    const prisma = getTestPrisma();
    const model = await seedVisibleModel(prisma);
    const fakeQueue = createFakeQueue();
    const fakeWallet = createFakeWallet();
    const fakeRabbit = createFakeRabbitmq();
    const user = testUser();

    const service = new GenerateService({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      wallet: fakeWallet.wallet,
      logger: createSilentLogger(),
      storage: null,
      fakeImageGeneration: true,
      generationQueue: fakeQueue.queue,
    });

    const result = await service.generate({
      user,
      body: generateBody(model.id),
      correlationId: user.correlationId!,
      idempotencyKey: `fake-ok-${randomUUID()}`,
    });

    await service.processQueuedJob(fakeQueue.enqueued[0]!.payload);

    const job = await prisma.generationJob.findUniqueOrThrow({
      where: { id: result.job.id },
    });
    expect(job.status).toBe("captured");

    const assistant = await prisma.generationMessage.findUniqueOrThrow({
      where: { id: result.assistantMessage.id },
    });
    expect(assistant.status).toBe("completed");
    expect(assistant.imageUrl).toBeTruthy();

    expect(fakeRabbit.published).toHaveLength(1);
    expect(fakeRabbit.published[0]?.routingKey).toBe(
      RoutingKeys.GENERATION_COMPLETED,
    );
  });

  it("finalizeJobFailure publishes generation.failed", async () => {
    const prisma = getTestPrisma();
    const model = await seedVisibleModel(prisma);
    const fakeQueue = createFakeQueue();
    const fakeWallet = createFakeWallet();
    const fakeRabbit = createFakeRabbitmq();
    const user = testUser();

    const service = new GenerateService({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      wallet: fakeWallet.wallet,
      logger: createSilentLogger(),
      storage: null,
      fakeImageGeneration: true,
      generationQueue: fakeQueue.queue,
    });

    const result = await service.generate({
      user,
      body: generateBody(model.id),
      correlationId: user.correlationId!,
      idempotencyKey: `fail-${randomUUID()}`,
    });

    const payload = fakeQueue.enqueued[0]!.payload;
    await service.finalizeJobFailure(payload, "provider blew up");

    const job = await prisma.generationJob.findUniqueOrThrow({
      where: { id: result.job.id },
    });
    expect(job.status).toBe("failed");
    expect(job.error).toBe("provider blew up");

    const assistant = await prisma.generationMessage.findUniqueOrThrow({
      where: { id: result.assistantMessage.id },
    });
    expect(assistant.status).toBe("failed");

    expect(fakeRabbit.published).toHaveLength(1);
    expect(fakeRabbit.published[0]?.routingKey).toBe(
      RoutingKeys.GENERATION_FAILED,
    );
  });

  it("finalizeJobFailure sync-releases when publish fails", async () => {
    const prisma = getTestPrisma();
    const model = await seedVisibleModel(prisma);
    const fakeQueue = createFakeQueue();
    const fakeWallet = createFakeWallet();
    const fakeRabbit = createFakeRabbitmq();
    const user = testUser();

    const service = new GenerateService({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      wallet: fakeWallet.wallet,
      logger: createSilentLogger(),
      storage: null,
      fakeImageGeneration: true,
      generationQueue: fakeQueue.queue,
    });

    const result = await service.generate({
      user,
      body: generateBody(model.id),
      correlationId: user.correlationId!,
      idempotencyKey: `fail-sync-${randomUUID()}`,
    });

    fakeRabbit.failNextPublish();
    await service.finalizeJobFailure(
      fakeQueue.enqueued[0]!.payload,
      "exhausted retries",
    );

    const job = await prisma.generationJob.findUniqueOrThrow({
      where: { id: result.job.id },
    });
    expect(job.status).toBe("released");
    expect(fakeWallet.releases).toHaveLength(1);
    expect(fakeWallet.releases[0]?.jobId).toBe(result.job.id);
  });
});
