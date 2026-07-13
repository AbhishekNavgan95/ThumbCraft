#!/usr/bin/env node
/**
 * Bootstrap RabbitMQ topology for local development.
 * Run after RabbitMQ is up: node infra/scripts/bootstrap-rabbitmq.mjs
 *
 * Creates:
 *  - exchange: platform.events (topic)
 *  - queues + bindings per plan.md
 */

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672";
const EXCHANGE = "platform.events";

const bindings = [
  { queue: "wallet.events", keys: ["user.registered", "generation.completed", "generation.failed"] },
  { queue: "generation.worker", keys: ["generation.requested"] },
  {
    queue: "notification.events",
    keys: [
      "auth.otp_requested",
      "user.registered",
      "generation.completed",
      "generation.failed",
      "wallet.purchase_completed",
      "wallet.purchase_failed",
    ],
  },
];

async function main() {
  const amqplib = await import("amqplib");
  const connection = await amqplib.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, "topic", { durable: true });

  for (const { queue, keys } of bindings) {
    await channel.assertQueue(queue, { durable: true });
    for (const key of keys) {
      await channel.bindQueue(queue, EXCHANGE, key);
      console.log(`bound ${queue} <- ${key}`);
    }
  }

  await channel.close();
  await connection.close();
  console.log("RabbitMQ topology ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
