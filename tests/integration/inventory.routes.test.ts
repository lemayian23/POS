import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { buildApp } from "../../src/app/build-app.js";
import { prisma } from "../../src/lib/prisma.js";

describe("Inventory routes", () => {
  const appPromise = buildApp();

  let app: Awaited<typeof appPromise>;
  let adminToken: string;
  let staffToken: string;
  let productId: string;
  let testSuffix: string;

  beforeEach(async () => {
    app = await appPromise;

    testSuffix = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const admin = await prisma.user.create({
      data: {
        name: `Inventory Admin ${testSuffix}`,
        email: `inventory-admin-${testSuffix}@example.com`,
        passwordHash: "test-hash",
        role: "ADMIN",
      },
    });

    const staff = await prisma.user.create({
      data: {
        name: `Inventory Staff ${testSuffix}`,
        email: `inventory-staff-${testSuffix}@example.com`,
        passwordHash: "test-hash",
        role: "STAFF",
      },
    });

    adminToken = app.jwt.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });

    staffToken = app.jwt.sign({
      sub: staff.id,
      email: staff.email,
      role: staff.role,
    });

    const product = await prisma.product.create({
      data: {
        sku: `INV-${testSuffix}`,
        name: "Inventory Test Product",
        price: "100.00",
        inventoryItem: {
          create: {
            quantity: 10,
            minStock: 5,
          },
        },
      },
    });

    productId = product.id;
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({
      where: {
        inventoryItem: {
          product: {
            sku: {
              startsWith: "INV-",
            },
          },
        },
      },
    });

    await prisma.inventoryItem.deleteMany({
      where: {
        product: {
          sku: {
            startsWith: "INV-",
          },
        },
      },
    });

    await prisma.product.deleteMany({
      where: {
        sku: {
          startsWith: "INV-",
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: "inventory-",
        },
      },
    });

    await app.close();
    await prisma.$disconnect();
  });

  it("rejects unauthenticated inventory access", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/inventory/${productId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it("allows authenticated staff to view inventory", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/inventory/${productId}`,
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.inventory).toMatchObject({
      productId,
      quantity: 10,
      minStock: 5,
    });
  });

  it("rejects unauthenticated stock adjustment", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/inventory/${productId}/adjust`,
      payload: {
        quantity: 5,
        type: "ADJUSTMENT_IN",
        notes: "Initial adjustment",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects staff stock adjustment", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/inventory/${productId}/adjust`,
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
      payload: {
        quantity: 5,
        type: "ADJUSTMENT_IN",
        notes: "Staff adjustment",
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("allows admin to increase stock", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/inventory/${productId}/adjust`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        quantity: 5,
        type: "ADJUSTMENT_IN",
        notes: "Stock received",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.inventory).toMatchObject({
      productId,
      quantity: 15,
      minStock: 5,
    });

    expect(body.movement).toMatchObject({
      type: "ADJUSTMENT_IN",
      quantity: 5,
      notes: "Stock received",
    });
  });

  it("allows admin to decrease stock", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/inventory/${productId}/adjust`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        quantity: 3,
        type: "ADJUSTMENT_OUT",
        notes: "Damaged stock",
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json().inventory.quantity).toBe(7);
  });

  it("rejects an adjustment that would make stock negative", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/inventory/${productId}/adjust`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        quantity: 11,
        type: "ADJUSTMENT_OUT",
        notes: "Too much stock removed",
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      error: "INSUFFICIENT_STOCK",
      message: "Insufficient stock for this adjustment.",
    });
  });

  it("rejects invalid adjustment data", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/inventory/${productId}/adjust`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        quantity: 0,
        type: "ADJUSTMENT_IN",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json().error).toBe("VALIDATION_ERROR");
  });

  it("records every successful adjustment as a stock movement", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/inventory/${productId}/adjust`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        quantity: 4,
        type: "ADJUSTMENT_IN",
        notes: "Restocking",
      },
    });

    expect(response.statusCode).toBe(200);

    const movements = await prisma.stockMovement.findMany({
      where: {
        inventoryItem: {
          productId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    expect(movements).toHaveLength(1);

    expect(movements[0]).toMatchObject({
      type: "ADJUSTMENT_IN",
      quantity: 4,
      notes: "Restocking",
    });
  });
});