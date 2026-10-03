import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app/build-app.js";
import { prisma } from "../../src/lib/prisma.js";
import { createUser } from "../../src/modules/auth/auth.service.js";

describe("Authorization", () => {
  let app: FastifyInstance;

  const staffEmail = `staff-${Date.now()}@example.com`;
  const adminEmail = `admin-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  let staffToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();

    await createUser(
      staffEmail,
      password,
      "Authorization Staff User",
    );

    await createUser(
      adminEmail,
      password,
      "Authorization Admin User",
    );

    await prisma.user.update({
      where: {
        email: adminEmail,
      },
      data: {
        role: "ADMIN",
      },
    });

    const staffLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: staffEmail,
        password,
      },
    });

    const adminLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: adminEmail,
        password,
      },
    });

    staffToken = staffLogin.json().token;
    adminToken = adminLogin.json().token;
  });

  beforeEach(async () => {
    // Intentionally empty.
    // Each test uses the users created in beforeAll.
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [staffEmail, adminEmail],
        },
      },
    });

    await app.close();
    await prisma.$disconnect();
  });

  it("rejects unauthenticated access to the admin route", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin-only",
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects a STAFF user from the admin route", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin-only",
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "FORBIDDEN",
      message: "You do not have permission to access this resource.",
    });
  });

  it("allows an ADMIN user to access the admin route", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin-only",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.message).toBe("You have administrator access.");
    expect(body.user.role).toBe("ADMIN");
  });
});