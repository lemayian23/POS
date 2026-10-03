import type { FastifyInstance } from "fastify";

import { loginSchema, registerSchema } from "./auth.schema.js";
import {
  authenticateUser,
  createUser,
} from "./auth.service.js";
import {
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  setRefreshTokenCookie,
} from "./auth.cookie.js";
import {
  createRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from "./refresh-token.service.js";

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const result = loginSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",
          message: "Invalid login request.",
          details: result.error.flatten(),
        });
      }

      const user = await authenticateUser(
        result.data.email,
        result.data.password,
      );

      if (!user) {
        return reply.status(401).send({
          error: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        });
      }

      const token = await app.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = await createRefreshToken(user.id);

      setRefreshTokenCookie(
        reply,
        refreshToken.token,
        refreshToken.expiresAt,
      );

      return reply.send({
        user,
        token,
      });
    },
  );

  app.post("/auth/refresh", async (request, reply) => {
    const refreshToken = getRefreshTokenCookie(request);

    if (!refreshToken) {
      return reply.status(401).send({
        error: "INVALID_REFRESH_TOKEN",
        message: "A valid refresh token is required.",
      });
    }

    const rotated = await rotateRefreshToken(refreshToken);

    if (!rotated) {
      return reply.status(401).send({
        error: "INVALID_REFRESH_TOKEN",
        message: "A valid refresh token is required.",
      });
    }

    const token = await app.jwt.sign({
      sub: rotated.user.id,
      email: rotated.user.email,
      role: rotated.user.role,
    });

    setRefreshTokenCookie(
      reply,
      rotated.token,
      rotated.expiresAt,
    );

    return reply.send({
      user: {
        id: rotated.user.id,
        email: rotated.user.email,
        name: rotated.user.name,
        role: rotated.user.role,
      },
      token,
    });
  });

  app.post("/auth/logout", async (request, reply) => {
    const refreshToken = getRefreshTokenCookie(request);

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    clearRefreshTokenCookie(reply);

    return reply.status(204).send();
  });

  app.post("/auth/register", async (request, reply) => {
    const result = registerSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Invalid registration request.",
        details: result.error.flatten(),
      });
    }

    const user = await createUser(
      result.data.email,
      result.data.password,
      result.data.name,
    );

    return reply.status(201).send({
      user,
    });
  });
}