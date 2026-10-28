import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

    try {
      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      expect(storedUser).not.toBeNull();
      expect(storedUser?.email).toBe(email);
    } finally {
      await prisma.user.delete({
        where: { id: user.id },
      });
    }
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
      where: { email },
    });

    expect(storedUser).toBeNull();
  });

  it("rejects negative inventory quantities at the database level", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sku = `CONSTRAINT-${suffix}`;

    const product = await prisma.product.create({
      data: {
        name: `Constraint Test Product ${suffix}`,
        sku,
        price: 100,
      },
    });

    try {
      const inventory = await prisma.inventoryItem.create({
        data: {
          productId: product.id,
          quantity: 0,
        },
      });

      // Zero is a valid inventory quantity.
      expect(inventory.quantity).toBe(0);

      // PostgreSQL must reject negative inventory.
      await expect(
        prisma.inventoryItem.update({
          where: { id: inventory.id },
          data: { quantity: -1 },
        }),
      ).rejects.toThrow();

      // The failed update must leave the stored quantity unchanged.
      const storedInventory = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: inventory.id },
      });

      expect(storedInventory.quantity).toBe(0);
    } finally {
      await prisma.product.delete({
        where: { id: product.id },
      });
    }
  });
});
