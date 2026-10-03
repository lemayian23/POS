import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireAuthentication(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({
      error: "UNAUTHORIZED",
      message: "Authentication is required.",
    });
  }
}