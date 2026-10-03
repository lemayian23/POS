import { z } from "zod";

export const createProductSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(100, "SKU must contain at most 100 characters"),

  name: z
    .string()
    .trim()
    .min(1, "Product name is required")
    .max(200, "Product name must contain at most 200 characters"),

  description: z
    .string()
    .trim()
    .max(2000, "Description must contain at most 2000 characters")
    .optional(),

  price: z
    .string()
    .regex(
      /^(?:[1-9]\d*)(?:\.\d{1,2})?$/,
      "Price must be a positive monetary value with at most 2 decimal places",
    ),

  categoryId: z
    .uuid("Category ID must be a valid UUID")
    .optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;