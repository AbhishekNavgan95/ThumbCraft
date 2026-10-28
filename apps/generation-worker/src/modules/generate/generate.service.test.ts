import { randomUUID } from "node:crypto";
import { AppError } from "@platform/errors";
import { describe, expect, it } from "vitest";
import { RoutingKeys } from "@platform/messaging-contract";
import { GenerateService } from "./generate.service.js";
import { finalizeCompleted } from "./finalize.js";
import { buildGenerationCompletedEvent } from "../../lib/events.js";
import { relayOutbox } from "../../lib/outbox.js";
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

  it("finalizeJobFailure keeps the failure event pending when publish fails", async () => {
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
    expect(job.status).toBe("failed");

    const outbox = await prisma.generationOutbox.findMany({
      where: { jobId: result.job.id },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.routingKey).toBe(RoutingKeys.GENERATION_FAILED);
    expect(outbox[0]?.attempts).toBe(1);
    expect(outbox[0]?.publishedAt).toBeNull();
    expect(fakeWallet.releases).toHaveLength(0);

    await relayOutbox({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      logger: createSilentLogger(),
    });

    const published = await prisma.generationOutbox.findUniqueOrThrow({
      where: { id: outbox[0]!.id },
    });
    expect(published.publishedAt).not.toBeNull();
    expect(fakeRabbit.published).toHaveLength(1);
    expect(fakeWallet.releases).toHaveLength(0);
  });

  it("retry after a publish failure finalizes instead of stranding", async () => {
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
      idempotencyKey: `retry-${randomUUID()}`,
    });
    const payload = fakeQueue.enqueued[0]!.payload;

    fakeRabbit.failNextPublish();
    await expect(service.processQueuedJob(payload)).resolves.toBeUndefined();

    let job = await prisma.generationJob.findUniqueOrThrow({
      where: { id: result.job.id },
    });
    expect(job.status).toBe("captured");

    let outbox = await prisma.generationOutbox.findMany({
      where: { jobId: result.job.id },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.routingKey).toBe(RoutingKeys.GENERATION_COMPLETED);
    expect(outbox[0]?.publishedAt).toBeNull();
    expect(fakeWallet.releases).toHaveLength(0);

    // A re-delivered Bull job must reconcile, not strand.
    await service.processQueuedJob(payload);

    job = await prisma.generationJob.findUniqueOrThrow({
      where: { id: result.job.id },
    });
    expect(job.status).toBe("captured");

    outbox = await prisma.generationOutbox.findMany({
      where: { jobId: result.job.id },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.publishedAt).not.toBeNull();
    expect(fakeWallet.releases).toHaveLength(0);
  });

  it("publish failure on the last attempt does not refund a delivered image", async () => {
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
      idempotencyKey: `last-attempt-${randomUUID()}`,
    });
    const payload = fakeQueue.enqueued[0]!.payload;

    // Image delivered, but the job row never reached a terminal state.
    await prisma.generationMessage.update({
      where: { id: result.assistantMessage.id },
      data: {
        status: "completed",
        imageUrl: "https://example.test/delivered.png",
        mimeType: "image/png",
        completedAt: new Date(),
      },
    });

    fakeRabbit.failNextPublish();
    await service.finalizeJobFailure(payload, "boom");

    const job = await prisma.generationJob.findUniqueOrThrow({
      where: { id: result.job.id },
    });
    expect(job.status).toBe("captured");

    const assistant = await prisma.generationMessage.findUniqueOrThrow({
      where: { id: result.assistantMessage.id },
    });
    expect(assistant.status).toBe("completed");
    expect(assistant.imageUrl).toBe("https://example.test/delivered.png");

    const outbox = await prisma.generationOutbox.findMany({
      where: { jobId: result.job.id },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.routingKey).toBe(RoutingKeys.GENERATION_COMPLETED);
    expect(fakeWallet.releases).toHaveLength(0);

    await relayOutbox({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      logger: createSilentLogger(),
    });
    expect(fakeRabbit.published).toHaveLength(1);
    expect(fakeWallet.releases).toHaveLength(0);
  });

  it("failed job is skipped on re-delivery", async () => {
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
      idempotencyKey: `redeliver-${randomUUID()}`,
    });
    const payload = fakeQueue.enqueued[0]!.payload;

    await prisma.generationJob.update({
      where: { id: result.job.id },
      data: { status: "failed", completedAt: new Date() },
    });
    const before = await prisma.generationJob.findUniqueOrThrow({
      where: { id: result.job.id },
    });

    await service.processQueuedJob(payload);

    const after = await prisma.generationJob.findUniqueOrThrow({
      where: { id: result.job.id },
    });
    expect(after.status).toBe("failed");
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());

    const assistant = await prisma.generationMessage.findUniqueOrThrow({
      where: { id: result.assistantMessage.id },
    });
    expect(assistant.status).toBe("processing");
    expect(await prisma.generationOutbox.count()).toBe(0);
    expect(fakeRabbit.published).toHaveLength(0);
  });

  it("double finalize publishes once", async () => {
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
      idempotencyKey: `double-${randomUUID()}`,
    });

    const event = buildGenerationCompletedEvent({
      userId: user.userId,
      jobId: result.job.id,
      correlationId: user.correlationId!,
      payload: { kind: "generation", imageUrls: ["https://example.test/a.png"] },
    });

    const first = await finalizeCompleted(
      { prisma },
      {
        jobId: result.job.id,
        assistantId: result.assistantMessage.id,
        assistant: { imageUrl: "https://example.test/a.png", mimeType: "image/png" },
        sessionId: result.session.id,
        interactionId: "interaction-1",
        event,
      },
    );
    const second = await finalizeCompleted(
      { prisma },
      {
        jobId: result.job.id,
        assistantId: result.assistantMessage.id,
        assistant: { imageUrl: "https://example.test/a.png", mimeType: "image/png" },
        sessionId: result.session.id,
        interactionId: "interaction-1",
        event,
      },
    );

    expect(first.finalized).toBe(true);
    expect(second.finalized).toBe(false);
    expect(await prisma.generationOutbox.count()).toBe(1);
    expect(fakeWallet.releases).toHaveLength(0);
  });

  it("relay publishes pending events and marks them sent", async () => {
    const prisma = getTestPrisma();
    const fakeRabbit = createFakeRabbitmq();
    const logger = createSilentLogger();

    const ids = [randomUUID(), randomUUID()];
    await prisma.generationOutbox.createMany({
      data: ids.map((id) => ({
        id,
        routingKey: RoutingKeys.GENERATION_COMPLETED,
        payload: { eventId: id, payload: {} },
      })),
    });

    const first = await relayOutbox({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      logger,
    });
    expect(first).toEqual({ published: 2, failed: 0 });
    expect(fakeRabbit.published).toHaveLength(2);
    expect(
      await prisma.generationOutbox.count({ where: { publishedAt: null } }),
    ).toBe(0);

    const second = await relayOutbox({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      logger,
    });
    expect(second).toEqual({ published: 0, failed: 0 });
    expect(fakeRabbit.published).toHaveLength(2);
  });

  it("relay retries after a publish failure", async () => {
    const prisma = getTestPrisma();
    const fakeRabbit = createFakeRabbitmq();
    const logger = createSilentLogger();
    const id = randomUUID();

    await prisma.generationOutbox.create({
      data: {
        id,
        routingKey: RoutingKeys.GENERATION_FAILED,
        payload: { eventId: id, payload: {} },
      },
    });

    fakeRabbit.failNextPublish();
    const first = await relayOutbox({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      logger,
    });
    expect(first).toEqual({ published: 0, failed: 1 });

    let row = await prisma.generationOutbox.findUniqueOrThrow({
      where: { id },
    });
    expect(row.attempts).toBe(1);
    expect(row.publishedAt).toBeNull();
    expect(row.lastError).toBeTruthy();

    const second = await relayOutbox({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      logger,
    });
    expect(second).toEqual({ published: 1, failed: 0 });

    row = await prisma.generationOutbox.findUniqueOrThrow({ where: { id } });
    expect(row.attempts).toBe(1);
    expect(row.publishedAt).not.toBeNull();
    expect(row.lastError).toBeNull();
    expect(fakeRabbit.published).toHaveLength(1);
  });
});
