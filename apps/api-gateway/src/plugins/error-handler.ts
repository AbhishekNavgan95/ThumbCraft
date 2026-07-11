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

    if (message.includes("File too large")) {
      return reply.status(400).send({ error: message });
    }

    if (message.includes("Only image files are allowed")) {
      return reply.status(400).send({
        error: "File upload error",
        message,
      });
    }

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
