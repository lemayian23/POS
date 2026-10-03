import { describe, expect, it } from "vitest";

import { ApplicationError } from "../../src/app/application-error.js";

describe("ApplicationError", () => {
  it("stores the application error code, message, and status code", () => {
    const error = new ApplicationError(
      "TEST_ERROR",
      "This is a test error.",
      409,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("TEST_ERROR");
    expect(error.message).toBe("This is a test error.");
    expect(error.statusCode).toBe(409);
  });
});