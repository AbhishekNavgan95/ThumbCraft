import { randomUUID } from "node:crypto";
import {
  RoutingKeys,
  type GenerationCompletedPayload,
  type GenerationFailedPayload,
  type PlatformEvent,
} from "@platform/messaging-contract";
import type { RabbitMQClient } from "@platform/rabbitmq-client";

export async function publishGenerationCompleted(
  rabbitmq: RabbitMQClient,
  input: {
    userId: string;
    jobId: string;
    correlationId: string;
    payload: GenerationCompletedPayload;
  },
): Promise<void> {
  const event: PlatformEvent<GenerationCompletedPayload> = {
    eventId: randomUUID(),
    correlationId: input.correlationId,
    timestamp: new Date().toISOString(),
    userId: input.userId,
    jobId: input.jobId,
    payload: input.payload,
  };
  await rabbitmq.publish(RoutingKeys.GENERATION_COMPLETED, event);
}

export async function publishGenerationFailed(
  rabbitmq: RabbitMQClient,
  input: {
    userId: string;
    jobId: string;
    correlationId: string;
    payload: GenerationFailedPayload;
  },
): Promise<void> {
  const event: PlatformEvent<GenerationFailedPayload> = {
    eventId: randomUUID(),
    correlationId: input.correlationId,
    timestamp: new Date().toISOString(),
    userId: input.userId,
    jobId: input.jobId,
    payload: input.payload,
  };
  await rabbitmq.publish(RoutingKeys.GENERATION_FAILED, event);
}
