export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    correlationId?: string;
  }
}
