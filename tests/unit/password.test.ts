import { describe, expect, it } from "vitest";

import {
  hashPassword,
  verifyPassword,
} from "../../src/lib/password.js";

describe("Password utilities", () => {
  it("hashes a password without storing the original password", async () => {
    const password = "TestPassword123!";

    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("verifies the correct password", async () => {
    const password = "TestPassword123!";

    const passwordHash = await hashPassword(password);

    await expect(
      verifyPassword(password, passwordHash),
    ).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const passwordHash = await hashPassword("TestPassword123!");

    await expect(
      verifyPassword("WrongPassword123!", passwordHash),
    ).resolves.toBe(false);
  });
});