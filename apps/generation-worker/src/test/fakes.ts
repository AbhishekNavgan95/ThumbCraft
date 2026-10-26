import { AppError } from "@platform/errors";
import type { RabbitMQClient } from "@platform/rabbitmq-client";
import type { Queue } from "bullmq";
import type {
  QuoteResult,
  ReserveResult,
  WalletClient,
  WalletUserHeaders,
} from "../lib/wallet-client.js";
import type { GenerationJobPayload } from "../queue/generation.queue.js";

export type EnqueuedJob = {
  name: string;
  payload: GenerationJobPayload;
  opts?: { jobId?: string };
};

export function createFakeQueue() {
  const enqueued: EnqueuedJob[] = [];
  let failNext = false;

  const queue = {
    async add(
      name: string,
      payload: GenerationJobPayload,
      opts?: { jobId?: string },
    ) {
      if (failNext) {
        failNext = false;
        throw new Error("queue unavailable");
      }
      enqueued.push({ name, payload, opts });
      return { id: opts?.jobId ?? payload.jobId };
    },
  } as unknown as Queue<GenerationJobPayload>;

  return {
    queue,
    enqueued,
    failNextEnqueue() {
      failNext = true;
    },
  };
}

export function createFakeRabbitmq() {
  const published: Array<{ routingKey: string; event: unknown }> = [];
  let failPublish = false;

  const rabbitmq = {
    async publish(routingKey: string, event: unknown) {
      if (failPublish) {
        failPublish = false;
        throw new Error("rabbitmq publish failed");
      }
      published.push({ routingKey, event });
    },
  } as unknown as RabbitMQClient;

  return {
    rabbitmq,
    published,
    failNextPublish() {
      failPublish = true;
    },
  };
}

export function createFakeWallet(options?: {
  coinCost?: number;
  reserveError?: AppError;
}) {
  const coinCost = options?.coinCost ?? 5;
  const reserves: Array<{ jobId: string; amount: number }> = [];
  const releases: Array<{ jobId: string }> = [];

  const wallet = {
    async quote(
      _headers: WalletUserHeaders,
      body: { kind: "prompt_enhance" | "generation" },
    ): Promise<QuoteResult> {
      return { kind: body.kind, coinCost };
    },
    async reserve(
      _headers: WalletUserHeaders,
      body: { jobId: string; amount: number },
    ): Promise<ReserveResult> {
      if (options?.reserveError) {
        throw options.reserveError;
      }
      reserves.push(body);
      return {
        jobId: body.jobId,
        amount: body.amount,
        balanceCoins: 100 - body.amount,
        reservedCoins: body.amount,
        idempotent: false,
      };
    },
    async release(
      _headers: WalletUserHeaders,
      body: { jobId: string },
    ): Promise<{ jobId: string; amount: number }> {
      releases.push(body);
      return { jobId: body.jobId, amount: coinCost };
    },
  } as unknown as WalletClient;

  return { wallet, reserves, releases, coinCost };
}

export function createSilentLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {},
    fatal() {},
    trace() {},
    child() {
      return createSilentLogger();
    },
  } as import("@platform/logger").Logger;
}
