
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { buildApp } from "../../src/app/build-app.js";
import { prisma } from "../../src/lib/prisma.js";

describe("Sale routes", () => {
  const appPromise = buildApp();

  let app: Awaited<typeof appPromise>;
  let cashierToken: string;
  let productId: string;
  let testSuffix: string;

  beforeEach(async () => {
    app = await appPromise;

    testSuffix = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const cashier = await prisma.user.create({
      data: {
        name: `Sales Cashier ${testSuffix}`,
        email: `sales-cashier-${testSuffix}@example.com`,
        passwordHash: "test-hash",
        role: "STAFF",
      },
    });

    cashierToken = app.jwt.sign({
      sub: cashier.id,
      email: cashier.email,
      role: cashier.role,
    });

    const product = await prisma.product.create({
      data: {
        sku: `SALE-${testSuffix}`,
        name: "Sales Test Product",
        price: "100.00",
        inventoryItem: {
          create: {
            quantity: 10,
            minStock: 2,
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
              startsWith: "SALE-",
            },
          },
        },
      },
    });

        await prisma.payment.deleteMany({
      where: {
        sale: {
          cashier: {
            email: {
              startsWith: "sales-cashier-",
            },
          },
        },
      },
    });

    await prisma.sale.deleteMany({
      where: {
        cashier: {
          email: {
            startsWith: "sales-cashier-",
          },
        },
      },
    });

    // Delete sales before products and cashier users.
    // Deleting a sale also deletes its items through the configured cascade.
    await prisma.sale.deleteMany({
      where: {
        items: {
          some: {
            product: {
              sku: {
                startsWith: "SALE-",
              },
            },
          },
        },
      },
    });

    await prisma.inventoryItem.deleteMany({
      where: {
        product: {
          sku: {
            startsWith: "SALE-",
          },
        },
      },
    });

    await prisma.product.deleteMany({
      where: {
        sku: {
          startsWith: "SALE-",
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: "sales-cashier-",
        },
      },
    });

    await app.close();
    await prisma.$disconnect();
  });

  it("rejects unauthenticated sales creation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sales",
      payload: {
        items: [
          {
            productId,
            quantity: 2,
          },
        ],
        payment: {
          method: "CASH",
          amount: 200,
        },
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("creates a completed sale and deducts inventory", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sales",
      headers: {
        authorization: `Bearer ${cashierToken}`,
      },
      payload: {
        items: [
          {
            productId,
            quantity: 2,
          },
        ],
        payment: {
          method: "CASH",
          amount: 200,
        },
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.sale).toMatchObject({
      status: "COMPLETED",
      subtotal: "200",
      discount: "0",
      tax: "0",
      total: "200",
    });

    const inventory = await prisma.inventoryItem.findUnique({
      where: {
        productId,
      },
    });

    expect(inventory?.quantity).toBe(8);
  });

  it("creates a sale item, payment and stock movement", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sales",
      headers: {
        authorization: `Bearer ${cashierToken}`,
      },
      payload: {
        items: [
          {
            productId,
            quantity: 3,
          },
        ],
        payment: {
          method: "MOBILE_MONEY",
          amount: 300,
          reference: "MPESA-TEST-001",
        },
      },
    });

    expect(response.statusCode).toBe(201);

    const saleId = response.json().sale.id;

    const sale = await prisma.sale.findUnique({
      where: {
        id: saleId,
      },
      include: {
        items: true,
        payments: true,
        stockMovements: true,
      },
    });

    expect(sale).not.toBeNull();

    if (!sale) {
      throw new Error("Expected the created sale to exist");
    }

    expect(sale.items).toHaveLength(1);

    const saleItem = sale.items[0];

    expect(saleItem).toBeDefined();

    if (!saleItem) {
      throw new Error("Expected a sale item to be created");
    }

    expect(saleItem).toMatchObject({
      productId,
      quantity: 3,
    });

    expect(saleItem.unitPrice.toString()).toBe("100");
    expect(saleItem.lineTotal.toString()).toBe("300");

    expect(sale.payments).toHaveLength(1);

    const payment = sale.payments[0];

    expect(payment).toBeDefined();

    if (!payment) {
      throw new Error("Expected a payment to be created");
    }

    expect(payment).toMatchObject({
      method: "MOBILE_MONEY",
      status: "COMPLETED",
      reference: "MPESA-TEST-001",
    });

    expect(payment.amount.toString()).toBe("300");

    expect(sale.stockMovements).toHaveLength(1);
    expect(sale.stockMovements[0]).toMatchObject({
      type: "SALE",
      quantity: 3,
    });
  });

  it("rejects a sale when inventory is insufficient", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sales",
      headers: {
        authorization: `Bearer ${cashierToken}`,
      },
      payload: {
        items: [
          {
            productId,
            quantity: 11,
          },
        ],
        payment: {
          method: "CASH",
          amount: 1100,
        },
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      error: "INSUFFICIENT_STOCK",
      message: "Insufficient stock for this sale.",
    });
  });

  it("rejects invalid sale data", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sales",
      headers: {
        authorization: `Bearer ${cashierToken}`,
      },
      payload: {
        items: [],
        payment: {
          method: "CASH",
          amount: 0,
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("VALIDATION_ERROR");
  });
});
