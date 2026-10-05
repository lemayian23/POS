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
      /^(?:0\.(?:0[1-9]|[1-9]\d)|[1-9]\d*(?:\.\d{1,2})?)$/,
      "Price must be a positive monetary value with at most 2 decimal places",
    ),

  categoryId: z
    .uuid("Category ID must be a valid UUID")
    .optional(),
});

export const updateProductSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1, "SKU is required")
      .max(100, "SKU must contain at most 100 characters")
      .optional(),

    name: z
      .string()
      .trim()
      .min(1, "Product name is required")
      .max(200, "Product name must contain at most 200 characters")
      .optional(),

    description: z
      .string()
      .trim()
      .max(2000, "Description must contain at most 2000 characters")
      .nullable()
      .optional(),

    price: z
      .string()
      .regex(
        /^(?:0\.(?:0[1-9]|[1-9]\d)|[1-9]\d*(?:\.\d{1,2})?)$/,
        "Price must be a positive monetary value with at most 2 decimal places",
      )
      .optional(),

    categoryId: z
      .uuid("Category ID must be a valid UUID")
      .nullable()
      .optional(),

    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export type CreateProductInput = z.infer<typeof createProductSchema>;
