import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { prisma } from "../../src/lib/prisma.js";
import { withTransaction } from "../../src/lib/database.js";

describe("Database transaction helper", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("commits changes when the transaction succeeds", async () => {
    const email = `transaction-success-${Date.now()}@example.com`;

    const user = await withTransaction(async (db) => {
      return db.user.create({
        data: {
          name: "Transaction Test User",
          email,
          passwordHash: "test-hash",
        },
      });
    });

    const storedUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
    });

    expect(storedUser).not.toBeNull();
    expect(storedUser?.email).toBe(email);

    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });
  });

  it("rolls back changes when the transaction fails", async () => {
    const email = `transaction-rollback-${Date.now()}@example.com`;

    await expect(
      withTransaction(async (db) => {
        await db.user.create({
          data: {
            name: "Rollback Test User",
            email,
            passwordHash: "test-hash",
          },
        });

        throw new Error("Force transaction rollback");
      }),
    ).rejects.toThrow("Force transaction rollback");

    const storedUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    expect(storedUser).toBeNull();
  });
});