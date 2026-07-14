declare module "fastify" {
  interface FastifyRequest {
    correlationId?: string;
  }
}
