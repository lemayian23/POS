import type {
  FastifyError,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ApplicationError } from "./application-error.js";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof ApplicationError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
    });
  }

  if (error.validation) {
    request.log.warn(
      {
        method: request.method,
        url: request.url,
      },
      "Request validation failed",
    );

    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: "The request contains invalid data.",
    });
  }

  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: "REQUEST_ERROR",
      message: error.message,
    });
  }

  request.log.error(
    {
      err: error,
      method: request.method,
      url: request.url,
    },
    "Unhandled application error",
  );

  return reply.status(500).send({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
}