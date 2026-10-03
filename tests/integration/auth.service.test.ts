import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "../../src/lib/prisma.js";
import {
  authenticateUser,
  createUser,
} from "../../src/modules/auth/auth.service.js";

describe("Authentication service", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: "auth-service-test-",
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: "auth-service-test-",
        },
      },
    });

    await prisma.$disconnect();
  });

  it("creates a user without exposing the password hash", async () => {
    const user = await createUser(
      "auth-service-test-create@example.com",
      "TestPassword123!",
      "Test User",
    );

    expect(user).toEqual(
      expect.objectContaining({
        email: "auth-service-test-create@example.com",
        name: "Test User",
      }),
    );

    expect(user).not.toHaveProperty("passwordHash");
  });

  it("rejects duplicate email addresses", async () => {
    await createUser(
      "auth-service-test-duplicate@example.com",
      "TestPassword123!",
      "First User",
    );

    await expect(
      createUser(
        "auth-service-test-duplicate@example.com",
        "AnotherPassword123!",
        "Second User",
      ),
    ).rejects.toMatchObject({
      code: "EMAIL_ALREADY_EXISTS",
      statusCode: 409,
    });
  });

  it("authenticates an active user with the correct password", async () => {
    await createUser(
      "auth-service-test-login@example.com",
      "TestPassword123!",
      "Login User",
    );

    const user = await authenticateUser(
      "auth-service-test-login@example.com",
      "TestPassword123!",
    );

    expect(user).toEqual(
      expect.objectContaining({
        email: "auth-service-test-login@example.com",
        name: "Login User",
      }),
    );
  });

  it("rejects an incorrect password", async () => {
    await createUser(
      "auth-service-test-password@example.com",
      "TestPassword123!",
      "Password User",
    );

    const user = await authenticateUser(
      "auth-service-test-password@example.com",
      "WrongPassword123!",
    );

    expect(user).toBeNull();
  });

  it("rejects an inactive user even with the correct password", async () => {
    const user = await createUser(
      "auth-service-test-inactive@example.com",
      "TestPassword123!",
      "Inactive User",
    );

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        isActive: false,
      },
    });

    const authenticatedUser = await authenticateUser(
      "auth-service-test-inactive@example.com",
      "TestPassword123!",
    );

    expect(authenticatedUser).toBeNull();
  });
});