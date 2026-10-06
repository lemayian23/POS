import { Prisma } from "../../generated/prisma/client.js";
import { ApplicationError } from "../../app/application-error.js";
import { prisma } from "../../lib/prisma.js";
import type { AdjustInventoryInput } from "./inventory.schema.js";

export class InventoryNotFoundError extends ApplicationError {
  constructor() {
    super(
      "INVENTORY_NOT_FOUND",
      "The inventory record for this product does not exist.",
      404,
    );

    this.name = "InventoryNotFoundError";
  }
}

export class InsufficientStockError extends ApplicationError {
  constructor() {
    super(
      "INSUFFICIENT_STOCK",
      "Insufficient stock for this adjustment.",
      409,
    );

    this.name = "InsufficientStockError";
  }
}

export async function getInventory(productId: string) {
  const inventory = await prisma.inventoryItem.findUnique({
    where: {
      productId,
    },
    select: {
      productId: true,
      quantity: true,
      minStock: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!inventory) {
    throw new InventoryNotFoundError();
  }

  return inventory;
}

export async function adjustInventory(
  productId: string,
  input: AdjustInventoryInput,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const inventory = await tx.inventoryItem.findUnique({
      where: {
        productId,
      },
    });

    if (!inventory) {
      throw new InventoryNotFoundError();
    }

    const newQuantity =
      input.type === "ADJUSTMENT_IN"
        ? inventory.quantity + input.quantity
        : inventory.quantity - input.quantity;

    if (newQuantity < 0) {
      throw new InsufficientStockError();
    }

    const updatedInventory = await tx.inventoryItem.update({
      where: {
        productId,
      },
      data: {
        quantity: newQuantity,
      },
      select: {
        productId: true,
        quantity: true,
        minStock: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const movement = await tx.stockMovement.create({
      data: {
        inventoryItemId: inventory.id,
        type: input.type,
        quantity: input.quantity,
        notes: input.notes ?? null,
        createdById: userId,
      },
      select: {
        id: true,
        inventoryItemId: true,
        type: true,
        quantity: true,
        notes: true,
        createdById: true,
        createdAt: true,
      },
    });

    return {
      inventory: updatedInventory,
      movement,
    };
  });
}