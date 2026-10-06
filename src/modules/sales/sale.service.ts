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
        where: {
          id: input.customerId,
        },
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
        id: {
          in: productIds,
        },
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

    const paymentAmount = new Prisma.Decimal(
      input.payment.amount,
    );

    if (!paymentAmount.equals(total)) {
      throw new ApplicationError(
        "PAYMENT_MISMATCH",
        "Payment amount must equal the sale total.",
        400,
      );
    }

    for (const item of input.items) {
      const inventory = await tx.inventoryItem.findUnique({
        where: {
          productId: item.productId,
        },
      });

      if (!inventory || inventory.quantity < item.quantity) {
        throw new InsufficientSaleStockError();
      }
    }

    const receiptNo = `POS-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

    const sale = await tx.sale.create({
      data: {
        receiptNo,
        customerId: input.customerId,
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
      include: {
        items: true,
      },
    });

    await tx.payment.create({
      data: {
        saleId: sale.id,
        method: input.payment.method,
        status: "COMPLETED",
        amount: paymentAmount,
        reference: input.payment.reference,
      },
    });

    for (const item of input.items) {
      const inventory = await tx.inventoryItem.update({
        where: {
          productId: item.productId,
        },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: inventory.id,
          type: StockMovementType.SALE,
          quantity: item.quantity,
          saleId: sale.id,
          createdById: cashierId,
        },
      });
    }

    const completedSale = await tx.sale.findUniqueOrThrow({
      where: {
        id: sale.id,
      },
      include: {
        items: true,
        payments: true,
      },
    });

    return completedSale;
  });
}