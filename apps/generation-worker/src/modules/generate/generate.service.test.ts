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

  // --- Turn serialization (brief 02) ---

  it("parallel submits: one accepted, one rejected with SESSION_BUSY", async () => {
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

    // Create a session first
    const session = await prisma.generationSession.create({
      data: { userId: user.userId, turnSeq: 0 },
    });
    const sessionId = session.id;
    const body = generateBody(model.id);

    const [r1, r2] = await Promise.allSettled([
      service.generate({
        user,
        body: { ...body, sessionId },
        correlationId: user.correlationId!,
        idempotencyKey: `race-${randomUUID()}`,
      }),
      service.generate({
        user,
        body: { ...body, sessionId },
        correlationId: user.correlationId!,
        idempotencyKey: `race-${randomUUID()}`,
      }),
    ]);

    const fulfilled = [r1, r2].filter(
      (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled",
    );
    const rejected = [r1, r2].filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({
      code: "SESSION_BUSY",
      statusCode: 409,
    });

    // Exactly one non-terminal job for this session
    const activeJobs = await prisma.generationJob.findMany({
      where: {
        sessionId,
        kind: "generation",
        status: { in: ["created", "reserved", "processing"] },
      },
    });
    expect(activeJobs).toHaveLength(1);
  });

  it("next turn continues from the session head", async () => {
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

    // Turn 1
    const turn1Result = await service.generate({
      user,
      body: generateBody(model.id),
      correlationId: user.correlationId!,
      idempotencyKey: `t1-${randomUUID()}`,
    });
    const turn1Payload = fakeQueue.enqueued[0]!.payload;
    await service.processQueuedJob(turn1Payload);

    const turn1Assistant = await prisma.generationMessage.findUniqueOrThrow({
      where: { id: turn1Result.assistantMessage.id },
    });
    const interactionId = turn1Assistant.interactionId!;

    // Verify the session head is at turn 1's interaction before turn 2 runs
    const sessionAfterTurn1 = await prisma.generationSession.findUniqueOrThrow({
      where: { id: turn1Result.session.id },
    });
    expect(sessionAfterTurn1.latestInteractionId).toBe(interactionId);

    // Turn 2
    const turn2Result = await service.generate({
      user,
      body: { ...generateBody(model.id), sessionId: turn1Result.session.id, originalPrompt: "make it red" },
      correlationId: user.correlationId!,
      idempotencyKey: `t2-${randomUUID()}`,
    });
    const turn2Payload = fakeQueue.enqueued[1]!.payload;
    await service.processQueuedJob(turn2Payload);

    // The session head should now be at turn 2's interaction
    const sessionAfterTurn2 = await prisma.generationSession.findUniqueOrThrow({
      where: { id: turn1Result.session.id },
    });
    expect(sessionAfterTurn2.latestInteractionId).not.toBe(interactionId);
    // Turn 2 should have its own interactionId
    expect(sessionAfterTurn2.latestInteractionId).toBeTruthy();
  });

  it("superseded turn does not move the head", async () => {
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

    // Create a session and two turns with turnSeq 2 and 3
    const session = await prisma.generationSession.create({
      data: { userId: user.userId, turnSeq: 3, latestInteractionId: "head-turn-3" },
    });

    // Create user message turnSeq 2
    const userMsg2 = await prisma.generationMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        modelId: model.id,
        originalPrompt: "turn 2",
        requiredAspectRatio: "16:9",
        requiredResolution: "1K",
        turnSeq: 2,
      },
    });
    const assistantMsg2 = await prisma.generationMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        modelId: model.id,
        referenceId: userMsg2.id,
        status: "queued",
        turnSeq: 2,
      },
    });
    const job2 = await prisma.generationJob.create({
      data: {
        userId: user.userId,
        kind: "generation",
        coinCost: 5,
        idempotencyKey: `superseded-${randomUUID()}`,
        sessionId: session.id,
        messageId: assistantMsg2.id,
        turnSeq: 2,
        status: "processing",
      },
    });

    // Turn 3 already "completed" (simulated by having a later turnSeq and a head)
    const userMsg3 = await prisma.generationMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        modelId: model.id,
        originalPrompt: "turn 3",
        requiredAspectRatio: "16:9",
        requiredResolution: "1K",
        turnSeq: 3,
      },
    });
    await prisma.generationMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        modelId: model.id,
        referenceId: userMsg3.id,
        status: "completed",
        imageUrl: "https://example.test/turn3.png",
        mimeType: "image/png",
        turnSeq: 3,
        interactionId: "head-turn-3",
        completedAt: new Date(),
      },
    });

    // Run the superseded turn (turn 2) - it should complete but NOT move the head
    const payload = { jobId: job2.id, userId: user.userId, correlationId: user.correlationId!, email: user.email, name: user.name, role: user.role };
    await service.processQueuedJob(payload);

    const afterSession = await prisma.generationSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    // Head should still be turn 3's interactionId
    expect(afterSession.latestInteractionId).toBe("head-turn-3");
  });

  it("final failure frees the session slot for a new turn", async () => {
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

    // Start a turn and fail it
    const result = await service.generate({
      user,
      body: generateBody(model.id),
      correlationId: user.correlationId!,
      idempotencyKey: `free-slot-${randomUUID()}`,
    });
    const payload = fakeQueue.enqueued[0]!.payload;
    await service.finalizeJobFailure(payload, "provider error");

    const failedJob = await prisma.generationJob.findUniqueOrThrow({
      where: { id: result.job.id },
    });
    expect(failedJob.status).toBe("failed");

    // Now submit again on the same session - should be accepted
    const secondResult = await service.generate({
      user,
      body: { ...generateBody(model.id), sessionId: result.session.id, originalPrompt: "retry" },
      correlationId: user.correlationId!,
      idempotencyKey: `free-slot-2-${randomUUID()}`,
    });

    expect(secondResult.job.status).toBe("processing");
    expect(secondResult.job.id).not.toBe(result.job.id);
  });
});
