import { randomUUID } from "node:crypto";
import {
  RoutingKeys,
  type GenerationCompletedPayload,
  type GenerationFailedPayload,
  type PlatformEvent,
} from "@platform/messaging-contract";
import type { RabbitMQClient } from "@platform/rabbitmq-client";

export interface GenerationEventInput<TPayload> {
  userId: string;
  jobId: string;
  correlationId: string;
  payload: TPayload;
}

/**
 * Build the full event envelope before the terminal transaction so the same
 * eventId is stored in the outbox and reused by every publish attempt.
 */
export function buildGenerationCompletedEvent(
  input: GenerationEventInput<GenerationCompletedPayload>,
): PlatformEvent<GenerationCompletedPayload> {
  return {
    eventId: randomUUID(),
    correlationId: input.correlationId,
    timestamp: new Date().toISOString(),
    userId: input.userId,
    jobId: input.jobId,
    payload: input.payload,
  };
}

export function buildGenerationFailedEvent(
  input: GenerationEventInput<GenerationFailedPayload>,
): PlatformEvent<GenerationFailedPayload> {
  return {
    eventId: randomUUID(),
    correlationId: input.correlationId,
    timestamp: new Date().toISOString(),
    userId: input.userId,
    jobId: input.jobId,
    payload: input.payload,
  };
}

export async function publishGenerationCompleted(
  rabbitmq: RabbitMQClient,
  input: GenerationEventInput<GenerationCompletedPayload>,
): Promise<void> {
  await rabbitmq.publish(
    RoutingKeys.GENERATION_COMPLETED,
    buildGenerationCompletedEvent(input),
  );
}

export async function publishGenerationFailed(
  rabbitmq: RabbitMQClient,
  input: GenerationEventInput<GenerationFailedPayload>,
): Promise<void> {
  await rabbitmq.publish(
    RoutingKeys.GENERATION_FAILED,
    buildGenerationFailedEvent(input),
  );
}
