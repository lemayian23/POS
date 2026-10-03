import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app/build-app.js";
import { prisma } from "../../src/lib/prisma.js";

describe("User registration", () => {
  let app: FastifyInstance;

  const email = `registration-${Date.now()}@example.com`;
  const password = "TestPassword123!";
  const name = "Registration Test User";

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email,
      },
    });

    await app.close();
    await prisma.$disconnect();
  });

  it("creates a user successfully", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password,
        name,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.user.email).toBe(email);
    expect(body.user.name).toBe(name);
    expect(body.user.role).toBe("STAFF");
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("rejects a duplicate email with 409 Conflict", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password,
        name,
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      error: "EMAIL_ALREADY_EXISTS",
      message: "A user with this email already exists.",
    });
  });

  it("rejects an invalid registration request", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "not-an-email",
        password: "short",
        name: "A",
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();

    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.message).toBe("Invalid registration request.");
  });
});