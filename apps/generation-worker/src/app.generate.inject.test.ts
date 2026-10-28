import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { GenerationWorkerConfig } from "./config.js";
import { GenerateService } from "./modules/generate/generate.service.js";
import {
  createFakeQueue,
  createFakeRabbitmq,
  createFakeWallet,
  createSilentLogger,
} from "./test/fakes.js";
import { generateBody, seedVisibleModel, testUser } from "./test/fixtures.js";
import { getTestPrisma } from "./test/setup.js";

function testConfig(): GenerationWorkerConfig {
  return {
    NODE_ENV: "test",
    PORT: 3003,
    LOG_LEVEL: "fatal",
    SERVICE_NAME: "generation-worker",
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://thumbcraft:thumbcraft@localhost:5432/generation_test",
    RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
    REDIS_URL: "redis://localhost:6379",
    WALLET_SERVICE_URL: "http://wallet.test",
    FAKE_IMAGE_GENERATION: true,
    OUTBOX_RELAY_INTERVAL_MS: 5000,
  };
}

describe("POST /api/generate inject", () => {
  it("returns 202 and creates reserved/enqueued work", async () => {
    const prisma = getTestPrisma();
    const model = await seedVisibleModel(prisma);
    const user = testUser();
    const fakeQueue = createFakeQueue();
    const fakeWallet = createFakeWallet();
    const fakeRabbit = createFakeRabbitmq();

    const generateService = new GenerateService({
      prisma,
      rabbitmq: fakeRabbit.rabbitmq,
      wallet: fakeWallet.wallet,
      logger: createSilentLogger(),
      storage: null,
      fakeImageGeneration: true,
      generationQueue: fakeQueue.queue,
    });

    const app = await createApp({
      config: testConfig(),
      logger: createSilentLogger(),
      prisma,
      enhanceService: null,
      uploadService: null,
      generateService,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/generate",
      headers: {
        "content-type": "application/json",
        "x-user-id": user.userId,
        "x-user-email": user.email,
        "x-user-name": user.name,
        "x-user-role": user.role,
        "x-correlation-id": user.correlationId!,
        "idempotency-key": `inject-${randomUUID()}`,
      },
      payload: generateBody(model.id),
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.job.status).toBe("processing");
    expect(fakeWallet.reserves).toHaveLength(1);
    expect(fakeQueue.enqueued).toHaveLength(1);

    await app.close();
  });

  it("returns 401 without trusted user headers", async () => {
    const prisma = getTestPrisma();
    const fakeQueue = createFakeQueue();
    const generateService = new GenerateService({
      prisma,
      rabbitmq: createFakeRabbitmq().rabbitmq,
      wallet: createFakeWallet().wallet,
      logger: createSilentLogger(),
      storage: null,
      fakeImageGeneration: true,
      generationQueue: fakeQueue.queue,
    });

    const app = await createApp({
      config: testConfig(),
      logger: createSilentLogger(),
      prisma,
      enhanceService: null,
      uploadService: null,
      generateService,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/generate",
      payload: { originalPrompt: "x" },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
