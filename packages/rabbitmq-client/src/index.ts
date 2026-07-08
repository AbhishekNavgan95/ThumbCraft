import amqplib from "amqplib";
import { PLATFORM_EXCHANGE, type PlatformEvent, type RoutingKey } from "@platform/messaging-contract";

export interface RabbitMQClientOptions {
  url: string;
}

export class RabbitMQClient {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(private readonly options: RabbitMQClientOptions) {}

  async connect(): Promise<void> {
    this.connection = await amqplib.connect(this.options.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(PLATFORM_EXCHANGE, "topic", { durable: true });
  }

  async publish<TPayload>(routingKey: RoutingKey, event: PlatformEvent<TPayload>): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ client is not connected");
    }

    const body = Buffer.from(JSON.stringify(event));
    this.channel.publish(PLATFORM_EXCHANGE, routingKey, body, {
      contentType: "application/json",
      persistent: true,
      messageId: event.eventId,
      correlationId: event.correlationId,
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.channel = null;
    this.connection = null;
  }
}

export { PLATFORM_EXCHANGE };
