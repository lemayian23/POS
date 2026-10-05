import { Prisma } from "../../generated/prisma/client.js";

import { ApplicationError } from "../../app/application-error.js";
import { prisma } from "../../lib/prisma.js";

import type {
  CreateProductInput,
  UpdateProductInput,
} from "./product.schema.js";

import type { ListProductsInput } from "./product-list.schema.js";

export class ProductSkuAlreadyExistsError extends ApplicationError {
  constructor() {
    super(
      "PRODUCT_SKU_ALREADY_EXISTS",
      "A product with this SKU already exists.",
      409,
    );

    this.name = "ProductSkuAlreadyExistsError";
  }
}

export class ProductCategoryNotFoundError extends ApplicationError {
  constructor() {
    super(
      "PRODUCT_CATEGORY_NOT_FOUND",
      "The specified product category does not exist.",
      404,
    );

    this.name = "ProductCategoryNotFoundError";
  }
}

export class ProductNotFoundError extends ApplicationError {
  constructor() {
    super(
      "PRODUCT_NOT_FOUND",
      "The specified product does not exist.",
      404,
    );

    this.name = "ProductNotFoundError";
  }
}

export async function createProduct(input: CreateProductInput) {
  try {
    return await prisma.product.create({
      data: {
        sku: input.sku,
        name: input.name,
        description: input.description ?? null,
        price: input.price,
        ...(input.categoryId
          ? {
              category: {
                connect: {
                  id: input.categoryId,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        price: true,
        isActive: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ProductSkuAlreadyExistsError();
      }

      if (error.code === "P2025") {
        throw new ProductCategoryNotFoundError();
      }
    }

    throw error;
  }
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
) {
  try {
    return await prisma.product.update({
      where: {
        id,
      },
      data: {
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.isActive !== undefined
          ? { isActive: input.isActive }
          : {}),
      },
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        price: true,
        isActive: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ProductSkuAlreadyExistsError();
      }

      if (error.code === "P2025") {
        throw new ProductNotFoundError();
      }

      if (error.code === "P2003") {
        throw new ProductCategoryNotFoundError();
      }
    }

    throw error;
  }
}

export async function listProducts() {
  return prisma.product.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      sku: true,
      name: true,
      description: true,
      price: true,
      isActive: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function listProductsPaginated(
  input: ListProductsInput,
) {
  const {
    page,
    pageSize,
    search,
    isActive,
    categoryId,
    sortBy,
    sortOrder,
  } = input;

  const where = {
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              sku: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(categoryId ? { categoryId } : {}),
  };

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: [
        {
          [sortBy]: sortOrder,
        },
        {
          id: "asc",
        },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        price: true,
        isActive: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.product.count({
      where,
    }),
  ]);

  return {
    products,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}