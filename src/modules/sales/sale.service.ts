
import {
  Prisma,
  SaleStatus,
  StockMovementType,
} from "../../generated/prisma/client.js";

import { ApplicationError } from "../../app/application-error.js";
import { prisma } from "../../lib/prisma.js";

import type { CreateSaleInput } from "./sale.schema.js";

export class InsufficientSaleStockError extends ApplicationError {
  constructor() {
    super(
      "INSUFFICIENT_STOCK",
      "Insufficient stock for this sale.",
      409,
    );
  }
}

export class ProductNotFoundForSaleError extends ApplicationError {
  constructor() {
    super(
      "PRODUCT_NOT_FOUND",
      "One or more products do not exist or are inactive.",
      404,
    );
  }
}

export class CustomerNotFoundForSaleError extends ApplicationError {
  constructor() {
    super(
      "CUSTOMER_NOT_FOUND",
      "The specified customer does not exist.",
      404,
    );
  }
}

export async function createSale(
  input: CreateSaleInput,
  cashierId: string,
) {
  return prisma.$transaction(async (tx) => {
    if (input.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
      });

      if (!customer) {
        throw new CustomerNotFoundForSaleError();
      }
    }

    const productIds = [
      ...new Set(input.items.map((item) => item.productId)),
    ];

    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new ProductNotFoundForSaleError();
    }

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    let subtotal = new Prisma.Decimal(0);

    const saleItems = input.items.map((item) => {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new ProductNotFoundForSaleError();
      }

      const unitPrice = product.price;
      const gross = unitPrice.mul(item.quantity);
      const lineTotal = gross.sub(item.discount);

      if (lineTotal.lessThan(0)) {
        throw new ApplicationError(
          "INVALID_SALE",
          "An item discount cannot exceed its line value.",
          400,
        );
      }

      subtotal = subtotal.add(lineTotal);

      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        discount: new Prisma.Decimal(item.discount),
        lineTotal,
      };
    });

    const discount = new Prisma.Decimal(input.discount);
    const tax = new Prisma.Decimal(input.tax);
    const total = subtotal.sub(discount).add(tax);

    if (total.lessThan(0)) {
      throw new ApplicationError(
        "INVALID_SALE",
        "The sale total cannot be negative.",
        400,
      );
    }

    const paymentAmount = new Prisma.Decimal(input.payment.amount);

    if (!paymentAmount.equals(total)) {
      throw new ApplicationError(
        "PAYMENT_MISMATCH",
        "Payment amount must equal the sale total.",
        400,
      );
    }

    // Aggregate duplicate product lines before checking or deducting stock.
    const requestedQuantities = new Map<string, number>();

    for (const item of input.items) {
      const current =
        requestedQuantities.get(item.productId) ?? 0;

      requestedQuantities.set(
        item.productId,
        current + item.quantity,
      );
    }

    // Fetch inventory records before creating the sale.
    // The quantities returned here are not trusted for the final deduction:
    // each deduction below also checks the current quantity atomically.
    const inventoryByProduct = new Map<
      string,
      { id: string; quantity: number }
    >();

    for (const productId of requestedQuantities.keys()) {
      const inventory = await tx.inventoryItem.findUnique({
        where: { productId },
        select: {
          id: true,
          quantity: true,
        },
      });

      if (!inventory) {
        throw new InsufficientSaleStockError();
      }

      if (inventory.quantity < (requestedQuantities.get(productId) ?? 0)) {
        throw new InsufficientSaleStockError();
      }

      inventoryByProduct.set(productId, inventory);
    }

    const receiptNo = `POS-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

    const sale = await tx.sale.create({
      data: {
        receiptNo,
        customerId: input.customerId ?? null,
        cashierId,
        status: SaleStatus.COMPLETED,
        subtotal,
        discount,
        tax,
        total,
        items: {
          create: saleItems,
        },
      },
    });

    // Conditionally decrement stock in the database.
    // Concurrent requests cannot both deduct units that are no longer available.
    for (const [productId, quantity] of requestedQuantities) {
      const inventory = inventoryByProduct.get(productId);

      if (!inventory) {
        throw new InsufficientSaleStockError();
      }

      const deduction = await tx.inventoryItem.updateMany({
        where: {
          id: inventory.id,
          quantity: { gte: quantity },
        },
        data: {
          quantity: { decrement: quantity },
        },
      });

      if (deduction.count !== 1) {
        throw new InsufficientSaleStockError();
      }

      await tx.stockMovement.create({
        data: {
          inventoryItemId: inventory.id,
          type: StockMovementType.SALE,
          quantity,
          saleId: sale.id,
          createdById: cashierId,
        },
      });
    }

    await tx.payment.create({
      data: {
        saleId: sale.id,
        method: input.payment.method,
        status: "COMPLETED",
        amount: paymentAmount,
        reference: input.payment.reference ?? null,
      },
    });

    return tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: {
        items: true,
        payments: true,
      },
    });
  });
}
