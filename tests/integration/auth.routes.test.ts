import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app/build-app.js";
import { prisma } from "../../src/lib/prisma.js";
import { hashPassword } from "../../src/lib/password.js";

describe("Authentication routes", () => {
  let app: FastifyInstance;
  let email: string;
  const password = "TestPassword123!";

  beforeEach(async () => {
    email = `auth-routes-${Date.now()}-${Math.random()}@example.com`;

    const passwordHash = await hashPassword(password);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Auth Routes Test User",
      },
    });
  });

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: {
        user: {
          email: {
            startsWith: "auth-routes-",
          },
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: "auth-routes-",
        },
      },
    });

    await prisma.$disconnect();
  });

  it("logs in successfully and sets an HttpOnly refresh-token cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.user.email).toBe(email);
    expect(body.user.name).toBe("Auth Routes Test User");
    expect(body.token).toEqual(expect.any(String));

    expect(body).not.toHaveProperty("refreshToken");

    const setCookie = response.headers["set-cookie"];

    expect(setCookie).toBeDefined();

    const cookieHeader = Array.isArray(setCookie)
      ? setCookie.join("; ")
      : setCookie;

    expect(cookieHeader).toContain("web_pos_refresh_token=");
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("SameSite=Strict");
    expect(cookieHeader).toContain("Path=/auth");
  });

  it("refreshes an access token using the refresh-token cookie", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password,
      },
    });

    expect(loginResponse.statusCode).toBe(200);

    const loginCookie = loginResponse.headers["set-cookie"];

    expect(loginCookie).toBeDefined();

    const cookie = Array.isArray(loginCookie)
      ? loginCookie[0]
      : loginCookie;

    if (!cookie) {
      throw new Error("Expected refresh-token cookie to be set.");
    }

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        cookie: cookie.split(";")[0],
      },
    });

    expect(refreshResponse.statusCode).toBe(200);

    const body = refreshResponse.json();

    expect(body.token).toEqual(expect.any(String));

    expect(body.user).toEqual({
      id: expect.any(String),
      email,
      name: "Auth Routes Test User",
      role: "STAFF",
    });

    expect(body).not.toHaveProperty("refreshToken");

    const rotatedCookie = refreshResponse.headers["set-cookie"];

    expect(rotatedCookie).toBeDefined();
    expect(rotatedCookie).not.toEqual(loginCookie);
  });

  it("rejects a refresh request without a cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      error: "INVALID_REFRESH_TOKEN",
      message: "A valid refresh token is required.",
    });
  });

  it("rejects the old refresh cookie after rotation", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password,
      },
    });

    expect(loginResponse.statusCode).toBe(200);

    const loginCookie = loginResponse.headers["set-cookie"];

    expect(loginCookie).toBeDefined();

    const cookie = Array.isArray(loginCookie)
      ? loginCookie[0]
      : loginCookie;

    if (!cookie) {
      throw new Error("Expected refresh-token cookie to be set.");
    }

    const refreshCookie = cookie.split(";")[0];

    const firstRefreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        cookie: refreshCookie,
      },
    });

    expect(firstRefreshResponse.statusCode).toBe(200);

    const secondRefreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        cookie: refreshCookie,
      },
    });

    expect(secondRefreshResponse.statusCode).toBe(401);

    expect(secondRefreshResponse.json()).toEqual({
      error: "INVALID_REFRESH_TOKEN",
      message: "A valid refresh token is required.",
    });
  });

  it("rejects a refresh token when the user has been deactivated", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password,
      },
    });

    expect(loginResponse.statusCode).toBe(200);

    const loginCookie = loginResponse.headers["set-cookie"];

    expect(loginCookie).toBeDefined();

    const cookie = Array.isArray(loginCookie)
      ? loginCookie[0]
      : loginCookie;

    if (!cookie) {
      throw new Error("Expected refresh-token cookie to be set.");
    }

    await prisma.user.update({
      where: {
        email,
      },
      data: {
        isActive: false,
      },
    });

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        cookie: cookie.split(";")[0],
      },
    });

    expect(refreshResponse.statusCode).toBe(401);

    expect(refreshResponse.json()).toEqual({
      error: "INVALID_REFRESH_TOKEN",
      message: "A valid refresh token is required.",
    });
  });

  it("logs out and revokes the refresh token", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password,
      },
    });

    expect(loginResponse.statusCode).toBe(200);

    const loginCookie = loginResponse.headers["set-cookie"];

    expect(loginCookie).toBeDefined();

    const cookie = Array.isArray(loginCookie)
      ? loginCookie[0]
      : loginCookie;

    if (!cookie) {
      throw new Error("Expected refresh-token cookie to be set.");
    }

    const refreshCookie = cookie.split(";")[0];

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        cookie: refreshCookie,
      },
    });

    expect(logoutResponse.statusCode).toBe(204);

    const logoutCookie = logoutResponse.headers["set-cookie"];

    expect(logoutCookie).toBeDefined();

    const logoutCookieHeader = Array.isArray(logoutCookie)
      ? logoutCookie.join("; ")
      : logoutCookie;

    expect(logoutCookieHeader).toContain("web_pos_refresh_token=");
    expect(logoutCookieHeader).toContain("Max-Age=0");
    expect(logoutCookieHeader).toContain("HttpOnly");
    expect(logoutCookieHeader).toContain("SameSite=Strict");
    expect(logoutCookieHeader).toContain("Path=/auth");

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        cookie: refreshCookie,
      },
    });

    expect(refreshResponse.statusCode).toBe(401);

    expect(refreshResponse.json()).toEqual({
      error: "INVALID_REFRESH_TOKEN",
      message: "A valid refresh token is required.",
    });
  });

  it("logs out successfully when no refresh token cookie is present", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
    });

    expect(response.statusCode).toBe(204);

    const setCookie = response.headers["set-cookie"];

    expect(setCookie).toBeDefined();

    const cookieHeader = Array.isArray(setCookie)
      ? setCookie.join("; ")
      : setCookie;

    expect(cookieHeader).toContain("web_pos_refresh_token=");
    expect(cookieHeader).toContain("Max-Age=0");
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("SameSite=Strict");
    expect(cookieHeader).toContain("Path=/auth");
  });

  it("registers a new user successfully", async () => {
    const registrationEmail = `register-${Date.now()}-${Math.random()}@example.com`;

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: registrationEmail,
        password: "TestPassword123!",
        name: "New Registration User",
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.user).toEqual({
      id: expect.any(String),
      email: registrationEmail,
      name: "New Registration User",
      role: "STAFF",
      createdAt: expect.any(String),
    });

    expect(body.user).not.toHaveProperty("password");
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("rejects registration when the email already exists", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "AnotherPassword123!",
        name: "Duplicate Registration User",
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      error: "EMAIL_ALREADY_EXISTS",
      message: "A user with this email already exists.",
    });
  });

  it("rejects registration with invalid input", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "not-an-email",
        password: "short",
        name: "",
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();

    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.message).toBe("Invalid registration request.");
    expect(body.details).toBeDefined();
  });

  it("rejects login with invalid input", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "not-an-email",
        password: "",
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();

    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.message).toBe("Invalid login request.");
    expect(body.details).toBeDefined();
  });
});