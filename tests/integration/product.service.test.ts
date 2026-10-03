import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "../../src/lib/prisma.js";

import {
  createProduct,
  listProducts,
  listProductsPaginated,
  ProductCategoryNotFoundError,
  ProductSkuAlreadyExistsError,
} from "../../src/modules/products/product.service.js";

describe("Product service", () => {
  let categoryId: string;
  const productIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();

    const category = await prisma.category.create({
      data: {
        name: `Product Test Category ${Date.now()}`,
        description: "Category used by Product service tests",
      },
    });

    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: {
        id: {
          in: productIds,
        },
      },
    });

    await prisma.category.delete({
      where: {
        id: categoryId,
      },
    });

    await prisma.$disconnect();
  });

  it("creates a product with a category", async () => {
    const product = await createProduct({
      sku: `TEST-${Date.now()}-1`,
      name: "Test Product",
      description: "Product service integration test",
      price: "125.50",
      categoryId,
    });

    productIds.push(product.id);

    expect(product.sku).toMatch(/^TEST-/);
    expect(product.name).toBe("Test Product");
    expect(product.description).toBe(
      "Product service integration test",
    );
    expect(product.price.toFixed(2)).toBe("125.50");
    expect(product.isActive).toBe(true);
    expect(product.categoryId).toBe(categoryId);
  });

  it("creates a product without a description or category", async () => {
    const product = await createProduct({
      sku: `TEST-${Date.now()}-2`,
      name: "Product Without Optional Fields",
      price: "50.00",
    });

    productIds.push(product.id);

    expect(product.description).toBeNull();
    expect(product.categoryId).toBeNull();
  });

  it("rejects a duplicate SKU", async () => {
    const sku = `TEST-DUPLICATE-${Date.now()}`;

    const firstProduct = await createProduct({
      sku,
      name: "First Product",
      price: "100.00",
    });

    productIds.push(firstProduct.id);

    await expect(
      createProduct({
        sku,
        name: "Second Product",
        price: "200.00",
      }),
    ).rejects.toBeInstanceOf(ProductSkuAlreadyExistsError);
  });

  it("lists products ordered by name", async () => {
    const firstProduct = await createProduct({
      sku: `TEST-LIST-${Date.now()}-1`,
      name: "Zebra Product",
      price: "20.00",
    });

    const secondProduct = await createProduct({
      sku: `TEST-LIST-${Date.now()}-2`,
      name: "Apple Product",
      price: "10.00",
    });

    productIds.push(firstProduct.id, secondProduct.id);

    const products = await listProducts();

    const testProducts = products.filter(
      (product) =>
        product.id === firstProduct.id ||
        product.id === secondProduct.id,
    );

    expect(testProducts.map((product) => product.name)).toEqual([
      "Apple Product",
      "Zebra Product",
    ]);
  });

  it("lists products with pagination and search", async () => {
    const appleProduct = await createProduct({
      sku: `TEST-PAGE-${Date.now()}-1`,
      name: "Pagination Apple Product",
      price: "10.00",
    });

    const bananaProduct = await createProduct({
      sku: `TEST-PAGE-${Date.now()}-2`,
      name: "Pagination Banana Product",
      price: "20.00",
    });

    const orangeProduct = await createProduct({
      sku: `TEST-PAGE-${Date.now()}-3`,
      name: "Pagination Orange Product",
      price: "30.00",
    });

    productIds.push(
      appleProduct.id,
      bananaProduct.id,
      orangeProduct.id,
    );

    const result = await listProductsPaginated({
      page: 1,
      pageSize: 2,
      search: "Pagination",
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.products).toHaveLength(2);

    expect(
      result.products.map((product) => product.name),
    ).toEqual([
      "Pagination Apple Product",
      "Pagination Banana Product",
    ]);

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it("rejects a nonexistent category", async () => {
    await expect(
      createProduct({
        sku: `TEST-NO-CATEGORY-${Date.now()}`,
        name: "Invalid Category Product",
        price: "75.00",
        categoryId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toBeInstanceOf(ProductCategoryNotFoundError);
  });
});