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

describe("Product routes", () => {
  let app: FastifyInstance;

  const testPrefix = `ROUTE-${Date.now()}-`;
  const staffEmail = `product-staff-${Date.now()}@example.com`;
  const adminEmail = `product-admin-${Date.now()}@example.com`;

  const password = "TestPassword123!";

  let staffToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();

    const staff = await createUser(
      staffEmail,
      password,
      "Product Route Staff",
    );

    const admin = await createUser(
      adminEmail,
      password,
      "Product Route Admin",
    );

    await prisma.user.update({
      where: { id: admin.id },
      data: { role: "ADMIN" },
    });

    staffToken = await app.jwt.sign({
      sub: staff.id,
      email: staff.email,
      role: staff.role,
    });

    adminToken = await app.jwt.sign({
      sub: admin.id,
      email: admin.email,
      role: "ADMIN",
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: {
        sku: {
          startsWith: testPrefix,
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [staffEmail, adminEmail],
        },
      },
    });

    await app.close();
    await prisma.$disconnect();
  });

  it("rejects unauthenticated product listing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/products",
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects unauthenticated product creation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/products",
      payload: {
        sku: `${testPrefix}UNAUTH`,
        name: "Unauthenticated Product",
        price: "100.00",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("allows STAFF to list products", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/products",
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toHaveProperty("products");
    expect(body).toHaveProperty("pagination");
    expect(body.pagination).toHaveProperty("page");
    expect(body.pagination).toHaveProperty("total");
  });

  it("rejects product creation by STAFF", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/products",
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
      payload: {
        sku: `${testPrefix}STAFF`,
        name: "Staff Created Product",
        price: "100.00",
      },
    });

    expect(response.statusCode).toBe(403);

    expect(response.json()).toEqual({
      error: "FORBIDDEN",
      message: "You do not have permission to access this resource.",
    });
  });

  it("allows ADMIN to create a product", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/products",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        sku: `${testPrefix}ADMIN`,
        name: "Admin Created Product",
        price: "150.00",
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.product).toMatchObject({
      sku: `${testPrefix}ADMIN`,
      name: "Admin Created Product",
      description: null,
      isActive: true,
      categoryId: null,
    });

    expect(body.product.id).toEqual(expect.any(String));
    expect(body.product.price).toBe("150");
  });

  it("rejects product creation when the SKU already exists", async () => {
    const sku = `${testPrefix}DUPLICATE`;

    const firstResponse = await app.inject({
      method: "POST",
      url: "/products",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        sku,
        name: "First Product",
        price: "100.00",
      },
    });

    expect(firstResponse.statusCode).toBe(201);

    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/products",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        sku,
        name: "Duplicate Product",
        price: "200.00",
      },
    });

    expect(duplicateResponse.statusCode).toBe(409);

    expect(duplicateResponse.json()).toEqual({
      error: "PRODUCT_SKU_ALREADY_EXISTS",
      message: "A product with this SKU already exists.",
    });
  });

  it("rejects product creation with a nonexistent category", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/products",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        sku: `${testPrefix}INVALID-CATEGORY`,
        name: "Product With Invalid Category",
        price: "100.00",
        categoryId: "00000000-0000-4000-8000-000000000000",
      },
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toEqual({
      error: "PRODUCT_CATEGORY_NOT_FOUND",
      message: "The specified product category does not exist.",
    });
  });

  it("rejects invalid product data", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/products",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        sku: "",
        name: "",
        price: "invalid",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      error: "VALIDATION_ERROR",
      message: "Invalid product data.",
    });
  });

    it("rejects a zero product price", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/products",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        sku: `${testPrefix}ZERO-PRICE`,
        name: "Zero Price Product",
        price: "0",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      error: "VALIDATION_ERROR",
      message: "Invalid product data.",
    });
  });

  it("rejects a zero product price with two decimal places", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/products",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        sku: `${testPrefix}ZERO-PRICE-DECIMAL`,
        name: "Zero Price Decimal Product",
        price: "0.00",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      error: "VALIDATION_ERROR",
      message: "Invalid product data.",
    });
  });

  it("rejects a product price with more than two decimal places", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/products",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        sku: `${testPrefix}THREE-DECIMALS`,
        name: "Three Decimal Product",
        price: "100.001",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      error: "VALIDATION_ERROR",
      message: "Invalid product data.",
    });
  });

  it("rejects a negative product price", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/products",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        sku: `${testPrefix}NEGATIVE-PRICE`,
        name: "Negative Price Product",
        price: "-10.00",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      error: "VALIDATION_ERROR",
      message: "Invalid product data.",
    });
    });

  it("rejects invalid product listing parameters", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/products?page=0&pageSize=500",
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      error: "VALIDATION_ERROR",
      message: "Invalid product listing parameters.",
    });
  });

  it("supports search and pagination through the API", async () => {
    const searchTerm = `${testPrefix}SEARCH`;

    await prisma.product.createMany({
      data: [
        {
          sku: `${searchTerm}-1`,
          name: `${searchTerm} Apple`,
          price: "10.00",
        },
        {
          sku: `${searchTerm}-2`,
          name: `${searchTerm} Banana`,
          price: "20.00",
        },
      ],
    });

    const response = await app.inject({
      method: "GET",
      url: `/products?search=${encodeURIComponent(searchTerm)}&page=1&pageSize=1&sortBy=name&sortOrder=asc`,
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.products).toHaveLength(1);
    expect(body.products[0].name).toBe(`${searchTerm} Apple`);

    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
  });

    it("filters products by active status", async () => {
    const activeSku = `${testPrefix}ACTIVE-FILTER`;
    const inactiveSku = `${testPrefix}INACTIVE-FILTER`;

    await prisma.product.createMany({
      data: [
        {
          sku: activeSku,
          name: "Active Filter Product",
          price: "30.00",
          isActive: true,
        },
        {
          sku: inactiveSku,
          name: "Inactive Filter Product",
          price: "40.00",
          isActive: false,
        },
      ],
    });

    const response = await app.inject({
      method: "GET",
      url: `/products?search=${encodeURIComponent(testPrefix)}&isActive=false`,
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.products).toHaveLength(1);
    expect(body.products[0]).toMatchObject({
      sku: inactiveSku,
      name: "Inactive Filter Product",
      isActive: false,
    });
  });

  it("sorts products by price in descending order", async () => {
    const sortPrefix = `${testPrefix}PRICE-SORT`;

    await prisma.product.createMany({
      data: [
        {
          sku: `${sortPrefix}-LOW`,
          name: "Low Price Product",
          price: "10.00",
        },
        {
          sku: `${sortPrefix}-HIGH`,
          name: "High Price Product",
          price: "90.00",
        },
        {
          sku: `${sortPrefix}-MID`,
          name: "Mid Price Product",
          price: "50.00",
        },
      ],
    });

    const response = await app.inject({
      method: "GET",
      url: `/products?search=${encodeURIComponent(sortPrefix)}&sortBy=price&sortOrder=desc`,
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.products.map((product: { sku: string }) => product.sku)).toEqual([
      `${sortPrefix}-HIGH`,
      `${sortPrefix}-MID`,
      `${sortPrefix}-LOW`,
    ]);
  });

  it("sorts products by SKU in ascending order", async () => {
    const sortPrefix = `${testPrefix}SKU-SORT`;

    await prisma.product.createMany({
      data: [
        {
          sku: `${sortPrefix}-C`,
          name: "SKU C Product",
          price: "30.00",
        },
        {
          sku: `${sortPrefix}-A`,
          name: "SKU A Product",
          price: "10.00",
        },
        {
          sku: `${sortPrefix}-B`,
          name: "SKU B Product",
          price: "20.00",
        },
      ],
    });

    const response = await app.inject({
      method: "GET",
      url: `/products?search=${encodeURIComponent(sortPrefix)}&sortBy=sku&sortOrder=asc`,
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.products.map((product: { sku: string }) => product.sku)).toEqual([
      `${sortPrefix}-A`,
      `${sortPrefix}-B`,
      `${sortPrefix}-C`,
    ]);
  });

    it("filters products by category and reports filtered pagination totals", async () => {
    const category = await prisma.category.create({
      data: {
        name: `Product Route Category ${Date.now()}`,
        description: "Category filter integration test",
      },
    });

    const matchingSku = `${testPrefix}CATEGORY-MATCH`;
    const otherSku = `${testPrefix}CATEGORY-OTHER`;

    try {
      await prisma.product.createMany({
        data: [
          {
            sku: matchingSku,
            name: "Matching Category Product",
            price: "25.00",
            categoryId: category.id,
          },
          {
            sku: otherSku,
            name: "Other Category Product",
            price: "35.00",
          },
        ],
      });

      const response = await app.inject({
        method: "GET",
        url: `/products?categoryId=${category.id}&page=1&pageSize=1`,
        headers: {
          authorization: `Bearer ${staffToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.products).toHaveLength(1);
      expect(body.products[0]).toMatchObject({
        sku: matchingSku,
        name: "Matching Category Product",
        categoryId: category.id,
      });

      expect(body.pagination).toEqual({
        page: 1,
        pageSize: 1,
        total: 1,
        totalPages: 1,
      });
    } finally {
      await prisma.product.deleteMany({
        where: {
          sku: {
            in: [matchingSku, otherSku],
          },
        },
      });

      await prisma.category.delete({
        where: {
          id: category.id,
        },
      });
    }
  });

  it("allows ADMIN to update an existing product", async () => {
  const sku = `${testPrefix}UPDATE`;

  const product = await prisma.product.create({
    data: {
      sku,
      name: "Original Product Name",
      price: "100.00",
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: `/products/${product.id}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "Updated Product Name",
        price: "150.00",
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json().product).toMatchObject({
      id: product.id,
      sku,
      name: "Updated Product Name",
      price: "150",
      isActive: true,
      categoryId: null,
    });
  } finally {
    await prisma.product.delete({
      where: { id: product.id },
    });
  }
  });
});