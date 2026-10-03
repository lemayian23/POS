import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { UserRole } from "../../generated/prisma/enums.js";

export function requireRole(...allowedRoles: UserRole[]) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: "Authentication is required.",
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "You do not have permission to access this resource.",
      });
    }
  };
}