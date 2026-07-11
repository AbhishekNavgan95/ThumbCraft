/** JWT payload shape — matches legacy backend User.generateToken(). */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    correlationId: string;
  }
}
