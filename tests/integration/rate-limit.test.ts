import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app/build-app.js";

describe("Login rate limiting", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects excessive login requests with 429", async () => {
    const responses = [];

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: "rate-limit-test@example.com",
          password: "WrongPassword123!",
        },
      });

      responses.push(response);
    }

    expect(responses[0]?.statusCode).toBe(401);
    expect(responses[1]?.statusCode).toBe(401);
    expect(responses[2]?.statusCode).toBe(401);
    expect(responses[3]?.statusCode).toBe(401);
    expect(responses[4]?.statusCode).toBe(401);

    expect(responses[5]?.statusCode).toBe(429);
  });
});