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
import { createUser } from "../../src/modules/auth/auth.service.js";
import rateLimit from "@fastify/rate-limit";

describe("JWT expiration", () => {
  let app: FastifyInstance;

  const email = `jwt-expiration-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  beforeAll(async () => {
    app = await buildApp();

    await createUser(
      email,
      password,
      "JWT Expiration Test User",
    );
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

  it("issues access tokens with a 15-minute expiration", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password,
      },
    });

    expect(response.statusCode).toBe(200);

    const { token } = response.json();

    expect(typeof token).toBe("string");

    const [, payloadPart] = token.split(".");

    expect(payloadPart).toBeDefined();

    const payload = JSON.parse(
      Buffer.from(payloadPart!, "base64url").toString("utf8"),
    ) as {
      iat?: number;
      exp?: number;
    };

    expect(payload.iat).toBeTypeOf("number");
    expect(payload.exp).toBeTypeOf("number");

    expect(payload.exp! - payload.iat!).toBe(15 * 60);
  });
});