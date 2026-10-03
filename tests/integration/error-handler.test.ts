import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app/build-app.js";

describe("Error handler", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();

    app.get("/test-error", async () => {
      throw new Error("This is an internal test error.");
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a safe 500 response for unexpected errors", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test-error",
    });

    expect(response.statusCode).toBe(500);

    expect(response.json()).toEqual({
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  });

  it("does not expose the internal error message", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test-error",
    });

    expect(response.body).not.toContain(
      "This is an internal test error.",
    );
  });
});