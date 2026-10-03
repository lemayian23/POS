import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";

import { env } from "../config/env.js";

export async function registerJwt(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    },
  });
}