import { Prisma } from "../../generated/prisma/client.js";
import { ApplicationError } from "../../app/application-error.js";
import { prisma } from "../../lib/prisma.js";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./category.schema.js";

export class CategoryNameAlreadyExistsError extends ApplicationError {
  constructor() {
    super(
      "CATEGORY_NAME_ALREADY_EXISTS",
      "A category with this name already exists.",
      409,
    );

    this.name = "CategoryNameAlreadyExistsError";
  }
}

export class CategoryNotFoundError extends ApplicationError {
  constructor() {
    super(
      "CATEGORY_NOT_FOUND",
      "The specified category does not exist.",
      404,
    );

    this.name = "CategoryNotFoundError";
  }
}

export async function createCategory(input: CreateCategoryInput) {
  try {
    return await prisma.category.create({
      data: {
        name: input.name,
        description: input.description ?? null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CategoryNameAlreadyExistsError();
    }

    throw error;
  }
}

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
) {
  try {
    return await prisma.category.update({
      where: {
        id,
      },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.isActive !== undefined
          ? { isActive: input.isActive }
          : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new CategoryNameAlreadyExistsError();
      }

      if (error.code === "P2025") {
        throw new CategoryNotFoundError();
      }
    }

    throw error;
  }
}