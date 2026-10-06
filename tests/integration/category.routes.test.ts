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

describe("Category routes", () => {
  let app: FastifyInstance;

  const testPrefix = `CATEGORY-${Date.now()}-`;
  const staffEmail = `category-staff-${Date.now()}@example.com`;
  const adminEmail = `category-admin-${Date.now()}@example.com`;

  const password = "TestPassword123!";

  let staffToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();

    const staff = await createUser(
      staffEmail,
      password,
      "Category Route Staff",
    );

    const admin = await createUser(
      adminEmail,
      password,
      "Category Route Admin",
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
    await prisma.category.deleteMany({
      where: {
        name: {
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

  it("rejects unauthenticated category listing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/categories",
    });

    expect(response.statusCode).toBe(401);
  });

  it("allows STAFF to list categories", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/categories",
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toHaveProperty("categories");
  });

  it("rejects unauthenticated category creation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/categories",
      payload: {
        name: `${testPrefix}UNAUTH`,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects category creation by STAFF", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
      payload: {
        name: `${testPrefix}STAFF`,
      },
    });

    expect(response.statusCode).toBe(403);

    expect(response.json()).toEqual({
      error: "FORBIDDEN",
      message: "You do not have permission to access this resource.",
    });
  });

  it("allows ADMIN to create a category", async () => {
    const name = `${testPrefix}ADMIN`;

    const response = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name,
        description: "Admin created category",
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.category).toMatchObject({
      name,
      description: "Admin created category",
      isActive: true,
    });

    expect(body.category.id).toEqual(expect.any(String));
  });

  it("rejects a duplicate category name", async () => {
    const name = `${testPrefix}DUPLICATE`;

    await prisma.category.create({
      data: {
        name,
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name,
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      error: "CATEGORY_NAME_ALREADY_EXISTS",
      message: "A category with this name already exists.",
    });
  });

  it("rejects invalid category data", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/categories",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "",
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      error: "VALIDATION_ERROR",
      message: "Invalid category data.",
    });
  });

  it("allows ADMIN to update a category", async () => {
    const category = await prisma.category.create({
      data: {
        name: `${testPrefix}UPDATE`,
        description: "Original description",
      },
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/categories/${category.id}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: `${testPrefix}UPDATED`,
        description: "Updated description",
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json().category).toMatchObject({
      id: category.id,
      name: `${testPrefix}UPDATED`,
      description: "Updated description",
      isActive: true,
    });
  });

  it("allows ADMIN to deactivate a category", async () => {
    const category = await prisma.category.create({
      data: {
        name: `${testPrefix}DEACTIVATE`,
      },
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/categories/${category.id}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        isActive: false,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json().category).toMatchObject({
      id: category.id,
      name: `${testPrefix}DEACTIVATE`,
      isActive: false,
    });
  });

  it("rejects category update by STAFF", async () => {
    const category = await prisma.category.create({
      data: {
        name: `${testPrefix}STAFF-UPDATE`,
      },
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/categories/${category.id}`,
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
      payload: {
        name: `${testPrefix}STAFF-UPDATED`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns 404 when updating a nonexistent category", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/categories/00000000-0000-0000-0000-000000000000",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: `${testPrefix}MISSING`,
      },
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toEqual({
      error: "CATEGORY_NOT_FOUND",
      message: "The specified category does not exist.",
    });
  });
});