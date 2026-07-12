export type UserRole = "customer" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    correlationId?: string;
    rawBody?: Buffer;
  }
}
