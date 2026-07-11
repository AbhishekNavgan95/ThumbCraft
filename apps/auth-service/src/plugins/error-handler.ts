import { isAppError } from "@platform/errors";
import type { FastifyInstance } from "fastify";
import type { Logger } from "@platform/logger";

export function registerErrorHandler(app: FastifyInstance, logger: Logger): void {
  app.setErrorHandler((error, request, reply) => {
    if (isAppError(error)) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";

    logger.error(
      { err: error, correlationId: request.correlationId, url: request.url },
      "unhandled request error",
    );

    return reply.status(500).send({
      error: "Internal server error",
      message,
    });
  });
}
