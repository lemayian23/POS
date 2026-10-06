import { z } from "zod";

export const createSaleItemSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    discount: z.number().nonnegative().default(0),
  })
  .strict();

export const createSaleSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    discount: z.number().nonnegative().default(0),
    tax: z.number().nonnegative().default(0),
    items: z.array(createSaleItemSchema).min(1),
    payment: z
      .object({
        method: z.enum([
          "CASH",
          "CARD",
          "MOBILE_MONEY",
          "OTHER",
        ]),
        amount: z.number().positive(),
        reference: z.string().trim().max(255).optional(),
      })
      .strict(),
  })
  .strict();

export type CreateSaleInput = z.infer<typeof createSaleSchema>;