import { z } from "zod";

export const listProductsSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),

  search: z
    .string()
    .trim()
    .max(200)
    .optional(),

  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  categoryId: z
    .uuid()
    .optional(),

  sortBy: z
    .enum(["name", "sku", "price", "createdAt"])
    .default("name"),

  sortOrder: z
    .enum(["asc", "desc"])
    .default("asc"),
});

export type ListProductsInput = z.infer<typeof listProductsSchema>;