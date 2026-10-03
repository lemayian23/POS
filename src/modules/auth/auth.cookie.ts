import type { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../../config/env.js";

export const REFRESH_TOKEN_COOKIE = "web_pos_refresh_token";

export function setRefreshTokenCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
) {
  reply.setCookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict",
    path: "/auth",
    expires: expiresAt,
  });
}

export function clearRefreshTokenCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict",
    path: "/auth",
  });
}

export function getRefreshTokenCookie(
  request: FastifyRequest,
): string | undefined {
  return request.cookies[REFRESH_TOKEN_COOKIE];
}