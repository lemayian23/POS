import type { UserRole } from "../generated/prisma/enums.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      role: UserRole;
    };

    user: {
      sub: string;
      email: string;
      role: UserRole;
    };
  }
}